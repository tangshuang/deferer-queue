export class DefererQueue {
  constructor(options) {
    this.queue = []
    this.callbacks = []
    this.fallbacks = []
    this.status = 0

    const defaultOptions = {
      mode: 'parallel',
      autoStart: true, // whether to auto start when push
      delay: 0, // whether to delay start when push
    }
    this.options = Object.assign({}, defaultOptions, options || {})
  }
  push(defer, callback, fallback, cancel) {
    const item = { defer, callback, fallback, cancel, status: 0 }

    item.promise = new Promise((resolve, reject) => {
      item.resolve = resolve
      item.reject = reject
    })

    this.queue.push(item)

    if (this.options.autoStart) {
      this.start()
    }

    return item.promise
  }
  stop(e) {
    this.status = -1
    this.fallbacks.forEach(fn => fn(e || new Error('stop')))
    return this
  }
  clear() {
    this.queue.forEach(item => typeof item.cancel === 'function' && item.cancel(item.defer))
    this.queue.length = 0
    return this
  }
  cancel(defer) {
    let item = this.queue.find(item => item.defer === defer)
    if (!item) {
      return this
    }

    if (typeof item.cancel === 'function') {
      item.cancel(item.defer)
    }

    let index = this.queue.findIndex(item => item.defer === defer)
    this.queue.splice(index, 1)

    return this
  }
  end() {
    this.status = 2
    this.queue.length = 0
    this.callbacks.forEach(fn => fn())
    return this
  }
  start() {
    // convert status
    if (this.status === 2) {
      this.status = 0
    }

    // delay to start, which set this.status 0.x means it's delayed to start
    if (this.options.delay > 0 && this.status >= 0 && this.status < 0.5) {
      // ensure setTimeout run only once
      if (this.status === 0) {
        setTimeout(() => {
          this.status = 0.9 // set a number which will not block the processing
          this.start()
        }, this.options.delay)
      }

      this.status = 0.1
      return
    }

    // emit all items in queue once
    if (this.options.mode === 'parallel') {
      this.queue.forEach((item) => {
        item.deferer = item.deferer || item.defer()
      })
    }

    // if queue is runing or destoryed, start will be disabled
    if (this.options.mode !== 'switch' && (this.status === 1 || this.status < -1)) {
      return
    }

    const run = () => {
      if (this.status !== 1) {
        return
      }

      // finish normally
      // or finish with cancel/clear
      if (!this.queue.length) {
        this.end()
        return
      }

      const mode = this.options.mode
      if (typeof run[mode] === 'function') {
        run[mode]()
      }
    }
    const success = (item) => (res) => {
      // clear/stop/end/cancel was run during the defer is running
      // so that there is no need to run the callbacks of this item any more
      if (this.queue.length && this.queue[0] !== item) {
        run()
        return
      }

      const { callback, resolve } = item
      if (typeof callback === 'function') {
        callback(res)
      }
      resolve(res)

      this.queue.shift()
      run()
    }
    const fail = (item) => (e) => {
      if (this.queue.length && this.queue[0] !== item) {
        run()
        return
      }

      const { fallback, reject } = item
      if (typeof fallback === 'function') {
        fallback(e)
      }
      reject(e)
      this.fallbacks.forEach(fn => fn(e))

      this.queue.shift()
      run()
    }
    // in serial
    run.serial = () => {
      const item = this.queue[0]
      const { defer } = item
      item.deferer = defer().then(success(item)).catch(fail(item))
    }
    // in parallel
    run.parallel = () => {
      const item = this.queue[0]
      const { deferer } = item
      deferer.then(success(item)).catch(fail(item))
    }

    // only use the last item
    run.switch = () => {
      const item = this.queue.pop()
      const { defer, callback, fallback, resolve, reject } = item

      // clear the queue, only leave the running one
      this.clear()
      this.queue.push(item)

      item.deferer = defer().then((res) => {
        // the item is canceled, drop it directly
        // the pushed item is running, and do not need to fire it any more
        if (this.queue.length && this.queue[0] !== item) {
          return
        }

        if (typeof callback === 'function') {
          callback(res)
        }
        resolve(res)

        this.end()
      }).catch((e) => {
        if (this.queue.length && this.queue[0] !== item) {
          return
        }

        if (typeof fallback === 'function') {
          fallback(e)
        }
        reject(e)

        this.fallbacks.forEach(fn => fn(e))
        this.status = 2
      })
    }

    // only use the first/latest item
    run.shift = () => {
      const item = this.queue.shift()

      // drop the other defers, only need the first one
      this.clear()
      this.queue.push(item)

      const runLatest = (item) => {
        const { defer, callback, fallback, resolve, reject } = item
        item.deferer = defer().then((res) => {
          if (this.queue.length && this.queue[0] !== item) {
            run()
            return
          }

          if (typeof callback === 'function') {
            callback(res)
          }
          resolve(res)

          if (this.queue.length) {
            const latest = this.queue.pop()

            // current one is the last one in queue, end the queue
            if (latest === item) {
              this.end()
              return
            }

            this.clear()
            this.queue.push(latest)

            runLatest(latest)
          }
          else {
            this.end()
          }
        }).catch((e) => {
          if (this.queue.length && this.queue[0] !== item) {
            run()
            return
          }

          if (typeof fallback === 'function') {
            fallback(e)
          }
          reject(e)
          this.fallbacks.forEach(fn => fn(e))

          // even though there is an error, the queue will continue
          if (this.queue.length) {
            const latest = this.queue.pop()

            // current one is the last one in queue, end the queue
            if (latest === item) {
              this.end()
              return
            }

            this.clear()
            this.queue.push(latest)

            runLatest(latest)
          }
          else {
            this.status = 2
          }
        })
      }

      runLatest(item)
    }

    this.status = 1
    run()

    return this
  }
  onEnd(fn) {
    this.callbacks.push(fn)
    return this
  }
  offEnd(fn) {
    this.callbacks = this.callbacks.filter(item => item !== fn)
    return this
  }
  onError(fn) {
    this.fallbacks.push(fn)
    return this
  }
  offError(fn) {
    this.fallbacks = this.fallbacks.filter(item => item !== fn)
    return this
  }
  destroy() {
    this.queue = []
    this.fallbacks = []
    this.callbacks = []
    this.status = -2
  }
}
export default DefererQueue

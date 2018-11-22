export class DefererQueue {
  constructor(options) {
    this.queue = []
    this.callbacks = []
    this.fallbacks = []
    this.status = 0
    this.options = Object.assign({}, { mode: 'parallel', autoStart: true }, options || {})
  }
  push(defer, callback, fallback, cancel) {
    const item = { defer, callback, fallback, cancel, status: 0 }

    if (this.options.mode === 'parallel') {
      item.deferer = typeof defer === 'function' ? defer() : defer
      item.status = 1
    }

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
    this.queue.forEach((item) => item.status === 1 && typeof item.cancel === 'function' && item.cancel())
    this.status = -1
    this.fallbacks.forEach(fn => fn(e || new Error('stop')))
    return this
  }
  clear() {
    this.queue.forEach((item) => typeof item.cancel === 'function' && item.cancel())
    this.queue.length = 0
    return this
  }
  cancel(defer) {
    let item = this.queue.find(item => item.defer === defer)
    if (!item) {
      return this
    }

    let index = this.queue.findIndex(item => item.defer === defer)
    typeof item.cancel === 'function' && item.cancel()
    this.queue.splice(index, 1)
    return this
  }
  end() {
    this.queue.forEach((item) => typeof item.cancel === 'function' && item.cancel())
    this.status = 2
    this.queue.length = 0
    this.callbacks.forEach(fn => fn())
    return this
  }
  start() {
    // if queue is runing or destoryed, start will be disabled
    if (this.status === 1 || this.status < -1) {
      return
    }

    const run = () => {
      // ended or stopped
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
    const shouldBeDroppedWhenFinish = (item) => {
      // item !== this.queue[0] means clear/stop/end/cancel was run during the defer is running
      // so that there is no need to run item any more
      return !this.queue[0] || item !== this.queue[0]
    }
    const success = (item) => (...args) => {
      item.status = 2

      if (shouldBeDroppedWhenFinish(item)) {
        run()
        return
      }

      const { callback, resolve } = item
      typeof callback === 'function' && callback(...args)
      resolve(...args)

      this.queue.shift()
      run()
    }
    const fail = (item) => (e) => {
      item.status = -1

      if (shouldBeDroppedWhenFinish(item)) {
        run()
        return
      }

      const { fallback, reject } = item
      typeof fallback === 'function' && fallback(e)
      reject(e)
      this.fallbacks.forEach(fn => fn(e))

      this.queue.shift()
      run()
    }
    // in serial
    run.serial = () => {
      const item = this.queue[0]
      const { defer } = item

      item.status = 1
      item.deferer = defer().then(success(item)).catch(fail(item))
    }
    // in parallel
    run.parallel = () => {
      const item = this.queue[0]
      const { deferer } = item

      item.status = 1
      deferer.then(success(item)).catch(fail(item))
    }
    // only use the last item
    run.switch = () => {
      const item = this.queue.pop()
      const { defer, callback, fallback, resolve, reject } = item

      // clear the queue,
      this.queue = [item]

      item.status = 1
      item.deferer = defer().then((...args) => {
        item.status = 2

        if (shouldBeDroppedWhenFinish(item)) {
          run()
          return
        }

        // remove current item
        this.queue.shift()

        // drop the current running defer if a new one pushed
        if (this.queue.length) {
          run()
          return
        }

        typeof callback === 'function' && callback(...args)
        resolve(...args)

        this.end()
      }).catch((e) => {
        item.status = -1

        if (shouldBeDroppedWhenFinish(item)) {
          run()
          return
        }

        // remove current item
        this.queue.shift()

        // drop the current running defer if a new one pushed
        if (this.queue.length) {
          run()
          return
        }

        typeof fallback === 'function' && fallback(e)
        reject(e)
        this.fallbacks.forEach(fn => fn(e))
      })
    }
    // only use the first/latest item
    run.shift = () => {
      const item = this.queue.shift()
      const runLatest = (item) => {
        let { defer, callback, fallback, resolve, reject } = item

        item.status = 1
        item.deferer = defer().then((...args) => {
          item.status = 2

          // the queue was not changed, which means stop/cancel/end/clear was not called
          if (this.queue[0] === item) {
            typeof callback === 'function' && callback(...args)
            resolve(...args)

            // remove current item
            this.queue.shift()
          }

          // if there are some new defers pushed into queue, use the latest to continue
          if (this.queue.length) {
            item = this.queue.pop()
            this.queue = [item]
            runLatest(item)
          }
          else {
            this.end()
          }
        }).catch((e) => {
          item.status = -1

          // the queue was not changed, which means stop/cancel/end/clear was not called
          if (this.queue[0] === item) {
            typeof fallback === 'function' && fallback(e)
            reject(e)
            this.fallbacks.forEach(fn => fn(e))

            // remove current item
            this.queue.shift()
          }

          // even though there is an error, the queue will continue
          if (this.queue.length) {
            item = this.queue.pop()
            this.queue = [item]
            runLatest(item)
          }
        })
      }

      // drop the other defers, only need the first one
      this.queue = [item]

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

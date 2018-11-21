export class DefererQueue {
  constructor(options) {
    this.queue = []
    this.callbacks = []
    this.fallbacks = []
    this.status = 0
    this.options = Object.assign({}, { mode: 'parallel', autoStart: true }, options || {})
  }
  push(defer, callback, fallback, cancel) {
    const item = { defer, callback, fallback, cancel }

    if (this.options.mode === 'parallel') {
      item.deferer = typeof defer === 'function' ? defer() : defer
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
    this.queue.forEach((item) => typeof item.cancel === 'function' && item.cancel())
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
    this.queue.forEach((item, i) => {
      if (item.defer === defer) {
        this.queue.splice(i, 1)
        typeof item.cancel === 'function' && item.cancel()
      }
    })
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
      if (mode === 'serial') {
        runSerial()
      }
      else if (mode === 'switch') {
        runSwitch()
      }
      else {
        runParallel()
      }
    }
    const next = (item) => (...args) => {
      const { deferer, callback, fallback, resolve, reject } = item
      // item !== this.queue[0] means clear/stop/end/cancel was runned when defer is running
      // so that there is no need to run item any more
      if (!this.queue[0] || item !== this.queue[0]) {
        run()
        return
      }

      typeof callback === 'function' && callback(...args)
      resolve(...args)
      this.queue.shift()
      run()
    }
    // in serial
    const runSerial = () => {
      const item = this.queue[0]
      const { defer, callback, fallback, resolve, reject } = item
      item.deferer = defer().then(next(item)).catch((e) => {
        typeof fallback === 'function' && fallback(e)
        reject(e)
        this.queue.shift()
        this.stop(e)
      })
    }
    // in parallel
    const runParallel = () => {
      const item = this.queue[0]
      const { deferer, callback, fallback, resolve, reject } = item
      deferer.then(next(item)).catch((e) => {
        if (!this.queue[0] || deferer !== this.queue[0].deferer) {
          run()
          return
        }

        typeof fallback === 'function' && fallback(e)
        reject(e)
        this.fallbacks.forEach(fn => fn(e))
        this.queue.shift()
        run()
      })
    }
    // switch to the last item
    const runSwitch = () => {
      const item = this.queue.pop()
      const { defer, callback, fallback, cancel, resolve, reject } = item

      // clear the queue
      this.clear()

      defer().then((...args) => {
        // drop the current running defer if a new one pushed
        if (this.queue.length) {
          typeof cancel === 'function' && cancel()
          run()
          return
        }

        typeof callback === 'function' && callback(...args)
        resolve(...args)
        this.end()
      }).catch((e) => {
        if (this.queue.length) {
          typeof cancel === 'function' && cancel()
          run()
          return
        }

        typeof fallback === 'function' && fallback(e)
        reject(e)
        this.fallbacks.forEach(fn => fn(e))
      })
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

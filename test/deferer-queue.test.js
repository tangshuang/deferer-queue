import DefererQueue from '../src/deferer-queue'

describe('DefererQueue', () => {
  test('parallel', (done) => {
    let log = ''
    let defer1 = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve()
        }, 500)
      })
    }
    let defer2 = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve()
        }, 200)
      })
    }

    let queue = new DefererQueue()
    queue.push(defer1, () => { log += '1' })
    queue.push(defer2, () => { log += '2' })

    queue.onEnd(() => {
      expect(log).toBe('12')
      done()
    })
  })
  test('serial', (done) => {
    let log = ''
    let running = ''
    let defer1 = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          log += '1'
          running += '1'
          resolve()
        }, 500)
      })
    }
    let defer2 = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          log += '2'
          running += '2'
          resolve()
        }, 500)
      })
    }

    let queue = new DefererQueue({ mode: 'serial' })
    queue.push(defer1)
    queue.push(defer2)

    queue.onEnd(() => {
      expect(log).toBe('12')
      expect(running).toBe('12')
      done()
    })
  })
  test('switch', (done) => {
    let log = ''
    let defer1 = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          log = '1'
          resolve()
        }, 100)
      })
    }
    let defer2 = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          log = '2'
          resolve()
        })
      })
    }

    let queue = new DefererQueue({ mode: 'switch' })
    queue.push(defer1)
    queue.push(defer2)

    queue.onEnd(() => {
      expect(log).toBe('2')
      done()
    })
  })
})

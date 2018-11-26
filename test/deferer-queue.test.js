import DefererQueue from '../src/deferer-queue'

describe('DefererQueue', () => {
  test('parallel', (done) => {
    let log = ''
    let defer1 = () => new Promise((resolve) => setTimeout(() => resolve('1'), 500))
    let defer2 = () => new Promise((resolve) => setTimeout(() => resolve('2'), 200))

    let queue = new DefererQueue()
    queue.push(defer1).then(num => { log += num })
    queue.push(defer2).then(num => { log += num })

    queue.onEnd(() => {
      expect(log).toBe('12')
      done()
    })
  })
  test('serial', (done) => {
    let log = ''
    let defer1 = () => new Promise((resolve) => setTimeout(() => resolve('1'), 500))
    let defer2 = () => new Promise((resolve) => setTimeout(() => resolve('2'), 500))

    let queue = new DefererQueue({ mode: 'serial' })
    queue.push(defer1).then(num => { log += num })
    queue.push(defer2).then(num => { log += num })

    queue.onEnd(() => {
      expect(log).toBe('12')
      done()
    })
  })
  test('switch', (done) => {
    let log = ''
    let defer1 = () => new Promise((resolve) => setTimeout(() => resolve('1'), 500))
    let defer2 = () => new Promise((resolve) => setTimeout(() => resolve('2'), 500))

    let queue = new DefererQueue({ mode: 'switch' })
    queue.push(defer1).then(num => { log += num })
    queue.push(defer2).then(num => { log += num })

    queue.onEnd(() => {
      expect(log).toBe('2')
      done()
    })
  })
})

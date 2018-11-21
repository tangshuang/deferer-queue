DEFERER QUEUE
===========

A deferer queue manager.

## Install

```
tnpm i deferer-queue
```

## Usage

```js
import DefererQueue from 'deferer-queue'
const queue = new DefererQueue(options)
```

```js
const defer1 = () => new Promise(...)
const defer2 = () => new Promise(...)

const queue = new DefererQueue({ mode: 'parallel' })
queue.push(defer1).then(callback1)
queue.push(defer2).then(callback2)
```

Notice: a defer is a function.
After calling `push` the queue will run automaticly.

## API


### constructor(options)

options:

- mode: how to run defer, default in parallel, optional
  - parallel: run defer immediately after pushing
  - serial: defer will run one by one after each deferer resolved
  - switch: always use the last deferer's results, when push a new defer, the old deferers will be dropped
- autoStart: whether to run queue immediately when invoke `push`

### push(defer, success, fail, cancel)

- defer: a function which return an instance of Promise
- success: invoke after deferer resolved
- fail: invoke after deferer rejected
- cancel: when a deferer is being dropped, cancel will be run

All of these parameters are functions.

```js
queue.push(defer1).then(callback).catch(fallback)
// is like:
queue.push(defer1, callback, fallback)
// however, callback/fallback in then/catch come before success/fail
```

_How to use axios with cancel？_

```js
const CancelToken = axios.CancelToken
const cancel = () => {}
const defer1 = () => {
  let token = new CancelToken(c => { cancel = c })
  return axios.get(url, { cancelToken: token })
}

const queue = new DefererQueue()
queue.push(defer1, null, null, cancel).then(res => console.log(res))
```

```js
queue.cancel(defer1)
```

### start()

Start the queue when you set `autoStart` to be false.
Or after stopped by `stop`, use start() to restart the queue.

When the queue is running, start will do nothing.

### clear()

Clear the queue. The left defers will not run any more.

### cancel(defer)

Cancel a certain defer. Notice, defer is the passed function.

At the same time, `cancel` which passed by `push` will be run too.

### stop()

Stop the queue. `onError` callbacks will be invoked.
However, defers which in the queue are not dropped, you can restart queue by using `queue.start()`.

### end()

Forcely end the queue.

**difference between clear, cancel, stop and end**

- clear: just drop the un-run defers, not change the status of queue
- cancel: just drop one defer
- end: drop the un-run defers and change the status of queue, `onEnd` callbacks will be invoked
- stop: not drop any defer, throw error manually, queue status changes, `onError` callbacks will be invoked, can be continue by `start`

### onEnd(fn)

Pass a function which will be invoked when the queue finish normanlly.
Use `offEnd` to unbind the callback.

```js
queue.onEnd(fn)

el.addEventListener('click', () => {
  queue.push(defer)
  if (queue.status !== 1) {
    queue.offEnd(fn) // 注意，要保持fn的引用
    queue.start()
  }
})
```

### onError(fn)

Pass a function which will be invoked when error appears.
Use `offError` to unbind.

```js
queue.onError(e => console.log(e))
```

### destroy()

Destory the queue.
️⚠️ Never use it when queue is running.

After destory, the queue is broken, don't use it any more.

## Development

```
tnpm i
tnpm test
```

```
tnpm run build
```

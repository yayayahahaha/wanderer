function TaskSystem(sequenceNumber) {
    this.sequence = sequenceNumber;
    this.doPromise = async () => {
        var promise = null,
            promiseReault = null,
            lastOne = false;

        if (this.__proto__.sourceArray.length === 0) {
            console.log('工作完成!');
            delete this.__proto__.taskListObject[this.sequence];

            if (Object.keys(this.__proto__.taskListObject).length === 0) {
                this.__proto__.callback(this.__proto__.returnResult);
            }
            return; // 這裡是return
        }

        // 從sourceArray 裡取出promise function
        promise = this.__proto__.sourceArray.splice(0, 1)[0];

        // 執行或直接賦值
        promiseReault = typeof promise === 'function' ? await promise() : promise;

        // 推進結果裡
        this.__proto__.returnResult.push(promiseReault);

        console.log(this.__proto__.sourceArray);

        if (lastOne) {
            this.__proto__.callback(this.__proto__.returnResult);
        }

        // 再來一次
        this.doPromise();
    }

    // 首次直接執行
    this.doPromise();
}
TaskSystem.prototype.sourceArray = [];
TaskSystem.prototype.returnResult = [];
TaskSystem.prototype.taskListObject = {};
TaskSystem.prototype.callback = Function.prototype;
TaskSystem.prototype.sequenceCounter = 0;

TaskSystem.prototype.init = function(sourceArray = [], returnResult = [], taskNumber = 8, callback = Function.prototype) {

    TaskSystem.prototype.sourceArray = sourceArray.slice();
    TaskSystem.prototype.returnResult = returnResult;
    TaskSystem.prototype.callback = callback;

    for (var i = 0; i < taskNumber; i++) {
        TaskSystem.prototype.sequenceCounter++;
        var sequence = `Task-System-${TaskSystem.prototype.sequenceCounter}`; // 製作流水號

        TaskSystem.prototype.taskListObject[sequence] = new TaskSystem(sequence);
    }
};

export {
    TaskSystem
};
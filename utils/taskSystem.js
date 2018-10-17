function TaskSystem(jobsArray = [], resultArray = [], taskNumber = 5, callback = Function.prototype) {
    var self = this;
    self.jobsArray = jobsArray;
    self.resultArray = resultArray;
    self.callback = callback;
    self.taskNumber = taskNumber;

    self.taskListObject = {};
    self.sequenceCounter = 0;
    self.totalJobsNumber = self.jobsArray.length;

    for (var i = 0; i < jobsArray.length; i++) {
        jobsArray[i]
    }

    function _Task(sequenceNumber) {
        this.sequence = sequenceNumber;
        this.doPromise = async () => {
            var promise = null,
                promiseReault = null,
                lastOne = false;

            if (this.__proto__.jobsArray.length === 0) {
                console.log('工作完成!');
                delete this.__proto__.taskListObject[this.sequence];

                if (Object.keys(this.__proto__.taskListObject).length === 0) {
                    this.__proto__.callback(this.__proto__.returnResult);
                }
                return; // 這裡是return
            }

            // 從jobsArray 裡取出promise function
            promise = this.__proto__.jobsArray.splice(0, 1)[0];

            // 執行或直接賦值
            promiseReault = typeof promise === 'function' ? await promise() : promise;

            // 推進結果裡
            this.__proto__.returnResult.push(promiseReault);

            console.log(this.__proto__.jobsArray);

            if (lastOne) {
                this.__proto__.callback(this.__proto__.returnResult);
            }

            // 再來一次
            this.doPromise();
        }

        // 首次直接執行
        this.doPromise();
    }
}

TaskSystem.prototype.init = function(jobsArray = [], returnResult = [], taskNumber = 8, callback = Function.prototype) {

    TaskSystem.prototype.jobsArray = jobsArray.slice();
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
function TaskSystem(jobsArray = [], resultArray = [], taskNumber = 5, callback = Function.prototype, setting = {}) {
    this.jobsArray = jobsArray.slice();
    this.resultArray = resultArray;
    this.callback = callback;
    this.taskNumber = taskNumber;

    this.workingTasksNumber = 0;
    this.sequenceCounter = 0;
    this.totalJobsNumber = this.jobsArray.length;

    this._doJobs = async function(resolve) {
        var job = null,
            jobReault = null,
            lastOne = false;

        if (this.jobsArray.length === 0) {
            this.workingTasksNumber--;

            console.log(`還剩下 ${ this.workingTasksNumber } 個task 還在執行`);

            if (this.workingTasksNumber === 0) {
                console.log('全部都結束囉!');
                this.callback(this.resultArray);
                resolve(this.resultArray);
            }

            return;
        }

        job = this.jobsArray.splice(0, 1)[0];

        jobReault = typeof job === 'function' ? await job() : job;

        this.resultArray.push(jobReault);

        this._doJobs(resolve);
    }

    this.doPromise = () => {
        return new Promise((resolve, reject) => {
            if (jobsArray.length === 0) {
                console.log('warning: 傳入的jobs 陣列為空');
                resolve(this.resultArray);
                return;
            }

            this.workingTasksNumber = this.taskNumber;
            for (var i = 0; i < this.taskNumber; i++) {
                this._doJobs(resolve);
            }
        })
    }
    // this.doPromise();
}

export {
    TaskSystem
};
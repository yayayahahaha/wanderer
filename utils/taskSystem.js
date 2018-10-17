function TaskSystem(jobsArray = [], resultArray = [], taskNumber = 5, callback = Function.prototype) {
    this.jobsArray = jobsArray;
    this.resultArray = resultArray;
    this.callback = callback;
    this.taskNumber = taskNumber;

    this.workingTasksNumber = 0;
    this.sequenceCounter = 0;
    this.totalJobsNumber = this.jobsArray.length;

    this.doJobs = async function(resolve) {
        var job = null,
            jobReault = null,
            lastOne = false;

        if (this.jobsArray.length === 0) {
            console.log('工作結束!');
            this.workingTasksNumber--;

            console.log(`還剩下${this.workingTasksNumber}個task 還在執行`);
            return;
        }

        job = this.jobsArray.splice(0, 1)[0];

        jobReault = typeof job === 'function' ? await job() : job;

        this.resultArray.push(jobReault);

        this.doJobs(resolve);
    }

    this._doPromise() {
        return new Promise((resolve, reject) => {
            for (var i = 0; i < jobsArray.length; i++) {
                this.workingTasksNumber++;
                this.doJobs(resolve);
            }
        })
    }
    this._doPromise();
}

export {
    TaskSystem
};
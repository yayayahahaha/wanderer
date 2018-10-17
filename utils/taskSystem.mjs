function TaskSystem(jobsArray = [], resultArray = [], taskNumber = 5, callback = Function.prototype, setting = {}) {
    this.jobsArray = jobsArray.slice();
    this.resultArray = resultArray;
    this.callback = callback;
    this.taskNumber = taskNumber;

    this.workingTasksNumber = 0;
    this.sequenceCounter = 0;
    this.totalJobsNumber = this.jobsArray.length;
    this.finishedJobs = 0;

    this._doJobs = async function(resolve) {
        var job = null,
            jobReault = null,
            lastOne = false;

        if (this.jobsArray.length === 0) {
            this.workingTasksNumber--;

            if (this.workingTasksNumber === 0) {
                this.callback(this.resultArray);
                resolve(this.resultArray);
            }

            return;
        }

        job = this.jobsArray.splice(0, 1)[0];

        jobReault = typeof job === 'function' ? await job().then((response) => {
            return {
                status: 1,
                data: response,
                meta: job
            };
        }).catch((error) => {
            return {
                status: 0,
                data: error,
                meta: job
            };
        }) : {
            status: 1,
            data: job,
            meta: job
        };

        var status = jobReault.status ? 'success' : 'failed',
            of = `${ this.finishedJobs } / ${ this.totalJobsNumber }`,
            persent = parseInt(this.finishedJobs, 10) * 100 / parseInt(this.totalJobsNumber, 10);

            persent = Math.round(persent * Math.pow(10, 2)) / 100;
            persent = `${ persent.toFixed(2) }%`;

        this.finishedJobs++;
        console.log(`${of}, ${persent}, ${status}`);

        this.resultArray.push(jobReault);

        this._doJobs(resolve);
    }

    this.doPromise = () => {
        return new Promise((resolve, reject) => {
            if (this.jobsArray.length === 0) {
                console.log('warning: 傳入的jobs 陣列為空');
                resolve(this.resultArray);
                return;
            }

            console.log(`要執行的任務共有 ${ this.jobsArray.length } 個`);
            console.log(`分給 ${ this.taskNumber } 個task 去執行`);
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
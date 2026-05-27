import { LightningElement, wire } from 'lwc';
import { createRecord, deleteRecord, updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import TASK_MANAGER_OBJECT from '@salesforce/schema/Task_Manager__c';
import TASK_TITLE_FIELD from '@salesforce/schema/Task_Manager__c.Task_Title__c';
import TASK_DATE_FIELD from '@salesforce/schema/Task_Manager__c.Task_Date__c';
import COMPLETED_DATE_FIELD from '@salesforce/schema/Task_Manager__c.Completed_Date__c';
import ISCOMPLETED_FIELD from '@salesforce/schema/Task_Manager__c.IsCompleted__c';
import ID_FIELD from '@salesforce/schema/Task_Manager__c.Id';

import loadAllIncompleteRecord from '@salesforce/apex/ToDoAppControler.loadAllIncompleteRecord';
import loadAllcompleteRecord from '@salesforce/apex/ToDoAppControler.loadAllcompleteRecord';
import clearAllCompletedRecords from '@salesforce/apex/ToDoAppControler.clearAllCompletedRecords';

export default class ToDoApplicantion extends LightningElement {
    taskname = '';
    taskdate = null;
    incompletetask = [];
    completetask = [];
    currentActiveTab = 'queue'; 

    incompleteTaskResult;
    completeTaskResult;

    get hasIncompleteTasks() {
        return this.incompletetask && this.incompletetask.length > 0;
    }

    get hasCompleteTasks() {
        return this.completetask && this.completetask.length > 0;
    }

    get isQueueTabVisible() {
        return this.currentActiveTab === 'queue';
    }

    get isArchiveTabVisible() {
        return this.currentActiveTab === 'archive';
    }

    get showClearAllButton() {
        return this.currentActiveTab === 'archive' && this.hasCompleteTasks;
    }

    get activeQueueTabClass() {
        return this.currentActiveTab === 'queue' ? 'tab-btn active-tab' : 'tab-btn';
    }

    get activeArchiveTabClass() {
        return this.currentActiveTab === 'archive' ? 'tab-btn active-tab' : 'tab-btn';
    }

    get completionPercentage() {
        const total = this.incompletetask.length + this.completetask.length;
        if (total === 0) return 0;
        return Math.round((this.completetask.length / total) * 100);
    }

    get progressBarWidth() {
        return `--progress-width: ${this.completionPercentage}%;`;
    }

    handleToggleActiveTab() {
        this.currentActiveTab = 'queue';
    }

    handleToggleArchiveTab() {
        this.currentActiveTab = 'archive';
    }

    @wire(loadAllIncompleteRecord) 
    wire_inCompleteRecord(result) {
        this.incompleteTaskResult = result;
        let { data, error } = result;
        if (data) {
            this.incompletetask = data.map((currItem) => ({
                taskId: currItem.Id,
                taskname: currItem.Task_Title__c || '', 
                taskdate: currItem.Task_Date__c
            }));
        } else if (error) {
            console.error(error);
            this.incompletetask = [];
        }
    }

    @wire(loadAllcompleteRecord) 
    wire_CompleteRecord(result) {
        this.completeTaskResult = result;
        let { data, error } = result;
        if (data) {
            this.completetask = data.map((currItem) => ({
                taskId: currItem.Id,
                taskname: currItem.Task_Title__c || '',
                taskdate: currItem.Task_Date__c
            }));
        } else if (error) {
            console.error(error);
            this.completetask = [];
        }
    }

    changeHandler(event) {
        let { name, value } = event.target;
        if (name === 'taskname') {
            this.taskname = value;
        } else if (name === 'taskdate') {
            this.taskdate = value;
        }
    }

    resetHandler() {
        this.taskname = '';
        this.taskdate = null;
        let element = this.template.querySelector(".taskname");
        if (element) {
            element.setCustomValidity("");
            element.reportValidity();
        }
    }

    addTaskHandler() {
        if (!this.taskdate) {
            this.taskdate = new Date().toISOString().slice(0, 10);
        }

        if (this.validatetask()) {
            let inputFields = {};
            inputFields[TASK_TITLE_FIELD.fieldApiName] = this.taskname;
            inputFields[TASK_DATE_FIELD.fieldApiName] = this.taskdate;
            inputFields[ISCOMPLETED_FIELD.fieldApiName] = false;

            let recordInput = {
                apiName: TASK_MANAGER_OBJECT.objectApiName,
                fields: inputFields
            };

            createRecord(recordInput)
                .then(() => {
                    this.showToast('Success', 'Task deployed into active operation queue.', 'success');
                    this.resetHandler();
                    return refreshApex(this.incompleteTaskResult);
                })
                .catch(error => {
                    this.showToast('Error', 'Record Creation Failed', 'error');
                    console.error(error);
                });
        }
    }

    validatetask() {
        let isValid = true;
        let element = this.template.querySelector(".taskname");

        if (!this.taskname) {
            isValid = false;
        } else {
            let taskItem = (this.incompletetask || []).find(
                (currItem) => currItem.taskname?.toLowerCase() === this.taskname.toLowerCase()
            );

            if (taskItem) {
                isValid = false;
                if (element) {
                    element.setCustomValidity('This initiative is already tracked inside your operational queue.');
                }
            }
        }

        if (isValid && element) {
            element.setCustomValidity("");
        }
        if (element) {
            element.reportValidity();
        }
        return isValid;
    }

    removeHandler(event) {
        let recordId = event.target.name;
        deleteRecord(recordId)
            .then(() => {
                this.showToast('Removed', 'Record completely expunged out of active dataset.', 'success');
                return refreshApex(this.incompleteTaskResult);
            })
            .catch((error) => {
                this.showToast('Delete Failed', 'Record Deletion Failed', 'error');
                console.error(error);
            });
    }

    removeCompletedHandler(event) {
        let recordId = event.target.name;
        deleteRecord(recordId)
            .then(() => {
                this.showToast('Purged', 'History entry removed permanently.', 'success');
                return refreshApex(this.completeTaskResult);
            })
            .catch((error) => {
                this.showToast('Delete Failed', 'Record Deletion Failed', 'error');
                console.error(error);
            });
    }

    handleClearAllCompleted() {
        clearAllCompletedRecords()
            .then(() => {
                this.showToast('Archive Flushed', 'Wiped out ledger histories completely.', 'success');
                return refreshApex(this.completeTaskResult);
            })
            .catch((error) => {
                this.showToast('Clear Error', 'Failed to mass clear records.', 'error');
                console.error(error);
            });
    }

    completeTaskHandler(event) {
        let recordId = event.target.name;
        this.refreshData(recordId);
    }

    async refreshData(recordId) {
        let inputFields = {};
        inputFields[ID_FIELD.fieldApiName] = recordId;
        inputFields[ISCOMPLETED_FIELD.fieldApiName] = true;
        inputFields[COMPLETED_DATE_FIELD.fieldApiName] = new Date().toISOString().slice(0, 10);

        let recordInput = { fields: inputFields };
        try {
            await updateRecord(recordInput);
            this.showToast('Task Executed', 'Initiative flagged complete and logged into history.', 'success');
            await refreshApex(this.incompleteTaskResult);
            await refreshApex(this.completeTaskResult);
        }
        catch(error){
            console.error(error);
            this.showToast('Error', 'Record Update Failed', 'error');
        }
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(event);
    }
}
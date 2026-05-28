
import { LightningElement, wire } from 'lwc';
import { createRecord, deleteRecord, updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

// Importing our custom Salesforce object and field names so we don't typo them
import TASK_MANAGER_OBJECT from '@salesforce/schema/Task_Manager__c';
import TASK_TITLE_FIELD from '@salesforce/schema/Task_Manager__c.Task_Title__c';
import TASK_DATE_FIELD from '@salesforce/schema/Task_Manager__c.Task_Date__c';
import COMPLETED_DATE_FIELD from '@salesforce/schema/Task_Manager__c.Completed_Date__c';
import ISCOMPLETED_FIELD from '@salesforce/schema/Task_Manager__c.IsCompleted__c';
import ID_FIELD from '@salesforce/schema/Task_Manager__c.Id';

// Pulling in our custom Apex methods for loading data and bulk clearing
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

    
    
    // Quick check to see if we actually have any pending tasks to display
    get hasIncompleteTasks() {
        return this.incompletetask && this.incompletetask.length > 0;
    }

    // Quick check to see if we have any finished tasks in the list
    get hasCompleteTasks() {
        return this.completetask && this.completetask.length > 0;
    }

    // Should we show the active queue? Only if the active tab is 'queue'
    get isQueueTabVisible() {
        return this.currentActiveTab === 'queue';
    }

    // Should we show the archive? Only if the active tab is 'archive'
    get isArchiveTabVisible() {
        return this.currentActiveTab === 'archive';
    }

    // Show the "Clear All" button only if we are in the archive tab AND there are tasks to clear
    get showClearAllButton() {
        return this.currentActiveTab === 'archive' && this.hasCompleteTasks;
    }

    // These two apply a CSS highlight class to the tab the user is actively clicking
    get activeQueueTabClass() {
        return this.currentActiveTab === 'queue' ? 'tab-btn active-tab' : 'tab-btn';
    }

    get activeArchiveTabClass() {
        return this.currentActiveTab === 'archive' ? 'tab-btn active-tab' : 'tab-btn';
    }

    // Math for the progress bar: (Done / Total Tasks) * 100
    get completionPercentage() {
        const total = this.incompletetask.length + this.completetask.length;
        if (total === 0) return 0;
        return Math.round((this.completetask.length / total) * 100);
    }

    // Passes the percentage number straight into the CSS loader width style
    get progressBarWidth() {
        return `--progress-width: ${this.completionPercentage}%;`;
    }

    
    // Tab Toggling 
    handleToggleActiveTab() {
        this.currentActiveTab = 'queue';
    }

    handleToggleArchiveTab() {
        this.currentActiveTab = 'archive';
    }

    
    // Grabs active tasks. We map the data so it's easier to use in JavaScript.
    @wire(loadAllIncompleteRecord)  // Wires: Grabbing data automatically from Apex
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

    // Grabs completed tasks from the database and maps them similarly
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


    
    // Watches the input fields and maps typed text/dates straight to our variables
    changeHandler(event) {      // Form Inputs & Input Validation
       
        let { name, value } = event.target;
        if (name === 'taskname') {
            this.taskname = value;
        } else if (name === 'taskdate') {
            this.taskdate = value;
        }
    }

    // Resets the text box, clears out date data, and removes any red error outlines
    resetHandler() {
        this.taskname = '';
        this.taskdate = null;
        let element = this.template.querySelector(".taskname");
        if (element) {
            element.setCustomValidity(""); 
            element.reportValidity();      
        }
    }

    // Handles the "Add" button logic
    addTaskHandler() {
        // If the user forgot to pick a date, just default it to today's date
        if (!this.taskdate) {
            this.taskdate = new Date().toISOString().slice(0, 10);
        }

        // Only run if the task name isn't a duplicate
        if (this.validatetask()) {
            let inputFields = {};
            inputFields[TASK_TITLE_FIELD.fieldApiName] = this.taskname;
            inputFields[TASK_DATE_FIELD.fieldApiName] = this.taskdate;
            inputFields[ISCOMPLETED_FIELD.fieldApiName] = false;

            let recordInput = {
                apiName: TASK_MANAGER_OBJECT.objectApiName,
                fields: inputFields
            };

            // Send record to Salesforce. Once done, toast success, reset the box, and refresh the UI data.
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

    // Prevents duplicate tasks from getting created
    validatetask() {
        let isValid = true;
        let element = this.template.querySelector(".taskname"); 

        if (!this.taskname) {
            isValid = false; 
        } else {
            // Checks if what the user typed matches any active task name (case-insensitive)
            let taskItem = (this.incompletetask || []).find(
                (currItem) => currItem.taskname?.toLowerCase() === this.taskname.toLowerCase()
            );

            // If we found a match, stop execution and throw a custom warning message on the UI
            if (taskItem) {
                isValid = false;
                if (element) {
                    element.setCustomValidity('This initiative is already tracked inside your operational queue.');
                }
            }
        }

        // Clear error highlights if everything checked out fine
        if (isValid && element) {
            element.setCustomValidity("");
        }
        if (element) {
            element.reportValidity(); // Forces the browser to show the pop-up warning message if invalid
        }
        return isValid;
    }

   
    
    // Deletes an active task and updates the list
    removeHandler(event) {  // Deleting Records
        let recordId = event.target.name; // Grabs the Salesforce record ID from the clicked button's name attribute
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

    // Deletes a completed task from the archive tab view
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

    // Calls Apex backend to mass-delete all completed tasks at once
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

    
    // Catches the task ID from the checkmark button and hands it down to our updater function
    completeTaskHandler(event) {    // Marking Tasks as Complete (Updates)
        let recordId = event.target.name;
        this.refreshData(recordId);
    }

    // Flips the status field to 'true' and sets a completion date timestamp
    async refreshData(recordId) {
        let inputFields = {};
        inputFields[ID_FIELD.fieldApiName] = recordId;                     
        inputFields[ISCOMPLETED_FIELD.fieldApiName] = true;                 
        inputFields[COMPLETED_DATE_FIELD.fieldApiName] = new Date().toISOString().slice(0, 10); 

        let recordInput = { fields: inputFields };
        try {
            // Wait until Salesforce updates the record successfully
            await updateRecord(recordInput);
            this.showToast('Task Executed', 'Initiative flagged complete and logged into history.', 'success');
            
            // Now, reload both UI lists so the task visually "moves" tabs immediately
            await refreshApex(this.incompleteTaskResult);
            await refreshApex(this.completeTaskResult);
        }
        catch(error){
            console.error(error);
            this.showToast('Error', 'Record Update Failed', 'error');
        }
    }

    
    // Reusable popup helper function to fire off standard green/red notification banners
    showToast(title, message, variant) {    // Utility Helpers 
        const event = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(event); 
    }
}
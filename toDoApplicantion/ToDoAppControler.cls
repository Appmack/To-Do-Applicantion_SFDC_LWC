public with sharing class ToDoAppControler {

    @AuraEnabled(cacheable=true)
    public static List<Task_Manager__c> loadAllIncompleteRecord() {
        try {   
            return [SELECT Id, Task_Title__c, Task_Date__c 
                    FROM Task_Manager__c 
                    WHERE OwnerId = :UserInfo.getUserId() AND IsCompleted__c = false 
                    WITH USER_MODE 
                    ORDER BY Task_Date__c ASC];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Task_Manager__c> loadAllcompleteRecord() {
        try {   
            return [SELECT Id, Task_Title__c, Task_Date__c 
                    FROM Task_Manager__c 
                    WHERE OwnerId = :UserInfo.getUserId() AND IsCompleted__c = true 
                    WITH USER_MODE 
                    ORDER BY Completed_Date__c DESC];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void clearAllCompletedRecords() {
        try {
            List<Task_Manager__c> completedTasks = [SELECT Id FROM Task_Manager__c 
                                                    WHERE OwnerId = :UserInfo.getUserId() 
                                                    AND IsCompleted__c = true
                                                    WITH USER_MODE];
            if (!completedTasks.isEmpty()) {
                delete as user completedTasks;
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

}
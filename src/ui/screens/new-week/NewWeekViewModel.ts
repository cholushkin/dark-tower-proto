export interface NewWeekViewModel {
  weekLabel:string;
  weekName:string;
  message:string;
  recoveryMessage:string;
  paydayTitle:string;
  paydayMessage:string;
  illustrationSrc:string;
  canOpenPayroll:boolean;
  payrollDisabledReason?:string;
  continueLabel:string;
}
export type NewWeekAction = {type:'continueRequested'} | {type:'openPayrollRequested'};

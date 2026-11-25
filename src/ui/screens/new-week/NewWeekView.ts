import { actionButton,artPanel,createPopupFrame,element } from '../../components/PopupFrame/PopupFrame';
import '../../components/PopupFrame/PopupFrame.css';
import type {NewWeekAction,NewWeekViewModel} from './NewWeekViewModel';
import './NewWeekView.css';
export interface NewWeekView {setModel(model:Readonly<NewWeekViewModel>):void;destroy():void}
export function mountNewWeekView(host:HTMLElement,model:Readonly<NewWeekViewModel>,onAction:(action:NewWeekAction)=>void):NewWeekView{
  let current=model;
  const render=()=>{
    const frame=createPopupFrame({title:'New Week',modifier:'week'});
    const art=artPanel(current.illustrationSrc,'A magical spider web spanning the tower walls','week');
    art.append(element('span','dt-art__corner dt-art__corner--left','◆'),element('span','dt-art__corner dt-art__corner--right','◆'));
    frame.body.append(element('p','dt-eyebrow',current.weekLabel),art);
    const title=element('h2','dt-feature-title',current.weekName);frame.body.append(title);
    const text=element('p','dt-week-message',current.message);frame.body.append(text);
    frame.body.append(element('p','dt-week-recovery',current.recoveryMessage));
    const pay=element('section','dt-payday-notice');
    pay.append(element('span','dt-payday-notice__icon','🪙'));
    const paycopy=element('div');paycopy.append(element('strong','dt-payday-notice__heading',current.paydayTitle),element('span','dt-payday-notice__text',current.paydayMessage));
    pay.append(paycopy);frame.body.append(pay);
    const next=actionButton(current.continueLabel,'gold',()=>onAction({type:'continueRequested'}),false,'▶');
    const payroll=actionButton('Open Payroll','outline',()=>onAction({type:'openPayrollRequested'}),!current.canOpenPayroll,'▤');
    if(current.payrollDisabledReason)payroll.title=current.payrollDisabledReason;
    frame.footer.append(next,payroll);host.replaceChildren(frame.root);
  };
  render();return {setModel(m){current=m;render();},destroy(){host.replaceChildren();}};
}

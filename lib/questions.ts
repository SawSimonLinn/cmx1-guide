export type Answer = 'yes' | 'no' | 'na' | '';
export type ResponseData = { answer: Answer; value?: string; note?: string };
export type Answers = Record<number, ResponseData>;
export type Question = { id: number; label: string; short: string; kind: 'binary' | 'text' | 'select' | 'multi'; options?: string[]; helper?: string; placeholder?: string };

export const questions: Question[] = [
  {id:1,short:'Product variety',label:'Is there a variety of packages available?',kind:'binary'},
  {id:2,short:'Promotional items',label:'Are promotional items available?',kind:'binary',placeholder:'e.g. Krab Rangoon Roll'},
  {id:3,short:'POP signage',label:'Is POP correct?',kind:'binary'},
  {id:4,short:'A-frame signage',label:'Is the A-frame sign posted correctly?',kind:'binary',helper:'Use N/A if the store does not require an A-frame sign.'},
  {id:5,short:'Package count',label:'What is the number of packages in the display cases?',kind:'text',placeholder:'Enter number of packages'},
  {id:6,short:'Product labels',label:'Are the labels correct?',kind:'binary',helper:'Verify expiration dates and allergens on two finished products.'},
  {id:7,short:'Label orientation',label:'What is the orientation of the labels used?',kind:'select',options:['Vertical (Up & Down)','Horizontal (Side to Side)','Mixed','Other']},
  {id:8,short:'Chef uniform',label:'Is the chef wearing a uniform?',kind:'binary',helper:'For Sprouts, also check required batch IDs.'},
  {id:9,short:'Logbooks',label:'Are logbooks complete and accurately filled?',kind:'binary'},
  {id:10,short:'Produce supplier',label:'Where does the chef buy produce?',kind:'text',placeholder:'e.g. Restaurant Depot',helper:'CMX1 also requests a photo of the most recent produce receipt.'},
  {id:11,short:'Display case',label:'What is the size of the case?',kind:'select',options:['4 ft','6 ft','8 ft','Other']},
  {id:12,short:'Sushi quality',label:'Does the quality of the sushi meet Hissho’s standard?',kind:'binary'},
  {id:13,short:'Operational infractions',label:'Were there operational infractions during this visit?',kind:'binary',helper:'YES means an infraction was found. Check hours, required items, Sushi Wednesday, and retailer complaints.'}
];

export const formNames = [
  'Company Chef Training Record','Franchise Business Review','Franchise Warning Notice Form','Franchisee Manual Collection',
  'Improvement Training Record Form','Inventory Loan Form','Lowe’s Food Report','Non-Traditional Store Evaluation',
  'Operational Excellence Review','Operational Excellence Review - Mein Bowl','PFZ Deal Form','Schnucks Store Visit',
  'Site Survey','Store Visit','SWOT','Travel Request Form','Unit Status Update Form'
];

const withDetail = (base: string, value?:string) => value?.trim() ? `${base} ${value.trim()}.` : base;

export function generateNote(q: Question, response?: ResponseData): string {
  if (!response) return '';
  const a = response.answer;
  const v = response.value?.trim();
  switch (q.id) {
    case 1: return a==='yes'?'A variety of sushi packages was available in the display case.':a==='no'?'Limited sushi variety was observed in the display case; additional assortment is needed.':'';
    case 2: return a==='yes' ? (v ? `The promotional ${v} was available in the sushi display case.`:'Promotional sushi items were available in the display case.') : a==='no'?'Promotional items were not available at the time of the visit.':'';
    case 3: return a==='yes'?'POP signage was correctly displayed at the sushi counter.':a==='no'?'POP signage was missing or not correctly displayed; correction is needed.':'';
    case 4: return a==='yes'?'The A-frame sign was correctly positioned and displayed.':a==='no'?'The required A-frame sign was missing or incorrectly positioned.':a==='na'?'A-frame signage was not applicable at this location.':'';
    case 5: return v ? `${v} sushi packages were counted in the display case${Number(v)===1?'':'s'}.`:'';
    case 6: return a==='yes'?'Expiration dates and allergen information were verified on two finished products; labels were correct.':a==='no'?'One or more product labels did not meet requirements; details and corrective action should be recorded.':'';
    case 7: return v ? `The sushi package labels were oriented ${v.toLowerCase()}.`:'';
    case 8: return a==='yes'?'The chef was wearing the required uniform during the visit.':a==='no'?'The chef was not wearing the complete required uniform; coaching is needed.':'';
    case 9: return a==='yes'?'Required logbooks were reviewed and found complete and accurately maintained.':a==='no'?'Required logbooks were incomplete or inaccurate and require correction.':a==='na'?'Logbook verification was not applicable to this visit.':'';
    case 10: return v?`The chef reported purchasing produce from ${v}. A recent receipt should be attached for verification.`:'';
    case 11: return v?`The sushi display case size was recorded as ${v}.`:'';
    case 12: return a==='yes'?'The sushi products met Hissho’s visual quality and presentation standards during the visit.':a==='no'?'Sushi quality or presentation did not meet Hissho’s standards; corrective action is needed.':'';
    case 13: return a==='yes'?'Operational infraction(s) were identified during the visit; document the specific issue(s) and required follow-up.':a==='no'?'No operational infractions were identified during the visit.':'';
    default: return withDetail('',v);
  }
}

export function effectiveNote(q: Question, r?: ResponseData) {return r?.note?.trim() || generateNote(q,r);}
export function isAnswered(q:Question, r?:ResponseData) {return q.kind==='binary'?Boolean(r?.answer):Boolean(r?.value?.trim());}
export function fullReport(answers: Answers) {
  return questions.filter(q=>isAnswered(q,answers[q.id])).map(q=>`${String(q.id).padStart(2,'0')}. ${q.short}\n${effectiveNote(q,answers[q.id])}`).join('\n\n');
}

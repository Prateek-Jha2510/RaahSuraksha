// Illustrative walks, times and street observations for our offline showcase.
import {getDemoTrip} from './demoRoutes.js';
const library=getDemoTrip('gate','library','faster');

function walk(id,title,description,start,end,paths,observations,notes){
  const routes=paths.map(([name,minutes,points])=>({id:name,label:name,minutes,points}));
  return {id,title,description,from:{name:start,point:routes[0].points[0]},to:{name:end,point:routes[0].points.at(-1)},routes,observations,notes};
}
const h=[28.7544,77.1117], j=[28.7568,77.1142];
const m=[28.7184,77.1082], n=[28.7212,77.1063];
const c=[28.7306,77.0960], d=[28.7333,77.0981];
export const walks=[
  {...library,id:'library',title:'Library walk',description:'A four-minute detour from the main gate.',notes:[
    'The side lane felt quiet near the bend; I could see the next crossing better from the longer path.',
    'The lamps on the library approach helped me see the pavement.']},
  walk('hostel','Hostel return','A hostel shortcut versus the canteen road.','Hostel courtyard','Residence gate',[
    ['Courtyard shortcut',6,[h,[28.7554,77.1128],j]],
    ['Canteen road',10,[h,[28.7545,77.1141],[28.7561,77.1151],j]]
  ],[[28.7554,77.1128,'unlit'],[28.7554,77.1128,'isolated'],[28.7545,77.1141,'lamp'],[28.7545,77.1141,'venue','07:00-23:00'],[28.7561,77.1151,'lamp']],
  ['The shortcut went quiet just past the courtyard.','I could see the canteen entrance from the bend.']),
  walk('market','Market closing','Compare the same market walk before and after closing.','Metro exit','Market square',[
    ['Arcade',7,[m,[28.7196,77.1075],n]],
    ['Bus stop road',9,[m,[28.7189,77.1057],[28.7204,77.1052],n]]
  ],[[28.7196,77.1075,'venue','09:00-21:00'],[28.7196,77.1075,'lamp'],[28.7189,77.1057,'lamp'],[28.7204,77.1052,'active'],[28.7204,77.1052,'venue','24/7']],
  ['When the shutters came down, the arcade emptied quickly.','The kiosk by the bus stop was still open when I passed.']),
  walk('sports','Sports ground exit','See how the app handles a shortcut with missing observations.','Sports pavilion','Pickup point',[
    ['Field edge',5,[c,[28.7318,77.0973],d]],['Perimeter walk',8,[c,[28.7324,77.0955],[28.7337,77.0966],d]]
  ],[[28.7324,77.0955,'lamp'],[28.7337,77.0966,'lamp']],
  ['I had little information about the stretch along the field.','I noticed two lit sections on the perimeter walk.'])
];
export function scenario(id='library'){return walks.find(w=>w.id===id);}


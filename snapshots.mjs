// Wire format for daily summaries (tracking.snapshots) in account sync. The app keeps the full format;
// only the copy sent to / stored on the server is compacted, and expanding it restores the full format
// exactly. Nothing is dropped: a day whose profile equals the previous day's profile carries
// `sameProfile:true` instead of a copy, and a plan whose `hash` is just that profile as JSON carries
// `hashFromProfile:true` instead of the string. Days are processed in date order.
const text=value=>JSON.stringify(value??null);
const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function compactSnapshots(snapshots){
 if(!isObject(snapshots))return snapshots;
 const out={};let previous;
 for(const day of Object.keys(snapshots).sort()){
  const snapshot=snapshots[day];
  if(!isObject(snapshot)||snapshot.sameProfile!==undefined){out[day]=snapshot;previous=undefined;continue}
  const profile=text(snapshot.profile),{profile:_,...rest}=snapshot,compact=profile===previous?{sameProfile:true,...rest}:{...snapshot};
  if(isObject(compact.plan)&&compact.plan.hash===profile){const {hash,...plan}=compact.plan;compact.plan={...plan,hashFromProfile:true}}
  out[day]=compact;previous=profile;
 }
 return out;
}
export function expandSnapshots(snapshots){
 if(!isObject(snapshots))return snapshots;
 const out={};let previous=null;
 for(const day of Object.keys(snapshots).sort()){
  const snapshot=snapshots[day];
  if(!isObject(snapshot)){out[day]=snapshot;continue}
  const {sameProfile,profile,...rest}=snapshot;
  const full={profile:sameProfile===true?(previous===null?null:JSON.parse(previous)):profile,...rest};
  if(sameProfile!==true&&!('profile' in snapshot))delete full.profile;
  if(isObject(full.plan)&&full.plan.hashFromProfile===true){const {hashFromProfile,date,...plan}=full.plan;full.plan={...(date!==undefined?{date}:{}),hash:text(full.profile),...plan}}
  out[day]=full;previous=text(full.profile);
 }
 return out;
}
const mapTracking=(state,fn)=>isObject(state)&&isObject(state.tracking)?{...state,tracking:{...state.tracking,snapshots:fn(state.tracking.snapshots)}}:state;
export const compactState=state=>mapTracking(state,compactSnapshots);
export const expandState=state=>mapTracking(state,expandSnapshots);

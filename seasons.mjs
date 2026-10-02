// General Turkish seasonal vegetable preferences, not regional harvest guarantees.
// Source: https://www.carrefoursa.com/blog/mevsim-sebzeleri/ (checked 2026-10-02).
// Only the seasonal vegetable lists are used; no health claims are imported.
export const SEASONS={winter:'Kış',spring:'İlkbahar',summer:'Yaz',autumn:'Sonbahar'};
const vegetables={
  broccoli:['winter','autumn'],carrot:['winter','autumn'],leek:['winter','autumn'],
  spinach:['winter','spring'],beet:['winter','autumn'],cauliflower:['winter'],
  chard:['winter','autumn'],pumpkin:['winter'],peas:['spring'],
  artichoke:['spring','autumn'],mushroom:['spring','autumn'],
  greenbean:['spring','summer','autumn'],cucumber:['spring','summer','autumn'],
  eggplant:['spring','summer','autumn'],zucchini:['summer'],tomato:['summer'],okra:['summer']
};
export function seasonFor(date=new Date()){
  const month=Number(new Intl.DateTimeFormat('en',{month:'numeric',timeZone:'Europe/Istanbul'}).format(date));
  return month===12||month<=2?'winter':month<=5?'spring':month<=8?'summer':'autumn';
}
export function selectedSeason(preference='auto',now=Date.now()){
  return preference==='off'?null:SEASONS[preference]?preference:seasonFor(new Date(now));
}
export function seasonalAffinity(recipe,ingredients,season){
  if(!season)return 0;
  let matching=0,total=0;
  for(const [id,amount] of recipe.items||[]){
    if(!vegetables[id])continue;
    const grams=amount*(ingredients[id]?.gramsPerUnit||1);
    if(grams<40)continue; // A garnish does not make the whole dish seasonal.
    total+=grams;if(vegetables[id].includes(season))matching+=grams;
  }
  return total?matching/total:0;
}

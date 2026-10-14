// Builds family-catalog.json: the trusted recipe data the account server uses to check shared family menus.
// Same derivation as the app (common-plan.mjs). Run after every change to catalog.json or daily-catalog.json;
// tests/common-plan.test.mjs fails if the published file is out of date.
import fs from 'node:fs';
import {mergeCatalog} from '../catalog.mjs';
import {buildFamilyCatalog} from '../common-plan.mjs';
const root=new URL('../',import.meta.url),read=name=>JSON.parse(fs.readFileSync(new URL(name,root)));
const family=buildFamilyCatalog(mergeCatalog(read('catalog.json'),read('daily-catalog.json')));
fs.writeFileSync(new URL('family-catalog.json',root),JSON.stringify(family)+'\n');
console.log('Ortak menü doğrulama kataloğu: '+Object.keys(family.recipes).length+' tarif.');

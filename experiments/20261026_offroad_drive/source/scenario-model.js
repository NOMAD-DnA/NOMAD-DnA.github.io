// Four controlled environment conditions; sensor settings are shared between them.
const SCENARIOS=Object.freeze([
  Object.freeze({id:1,title:'1. 평지',slope:0,rough:0,obstacles:'none',path:'A → 평지 직선 주행 → B',description:'지면이 수평이고 요철과 장애물이 없는 환경에서 A부터 B까지 직선 주행합니다.'}),
  Object.freeze({id:2,title:'2. 경사 + 요철',slope:10,rough:.04,obstacles:'none',path:'A → 요철 → 10° 오르막 → B',description:'X 6m부터 기본 10° 오르막이 시작되고 요철이 있습니다. 나무와 돌 장애물 없이 직선 주행합니다.'}),
  Object.freeze({id:3,title:'3. 요철 + 장애물',slope:0,rough:.04,obstacles:'mixed',path:'A → 요철과 장애물 우회 → B',description:'기본 오르막은 0°이며 요철과 나무, 돌이 있습니다. 장애물을 우회하는 경로를 따라갑니다.'}),
  Object.freeze({id:4,title:'4. 경사 + 요철 + 장애물',slope:10,rough:.04,obstacles:'mixed',path:'A → 장애물 우회 → 10° 오르막 + 요철 → B',description:'X 6m부터 기본 10° 오르막이 시작되고 요철과 나무, 돌이 있습니다. 장애물을 우회하며 B까지 이동합니다.'})
]);

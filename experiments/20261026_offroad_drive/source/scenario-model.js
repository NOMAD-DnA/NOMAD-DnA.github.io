// Four controlled environments; sensor settings are shared between them.
const SCENARIOS=Object.freeze([
  Object.freeze({id:1,title:'1. 평지',slope:0,rough:0,obstacles:'none',path:'A → 평지 직선 주행 → B',description:'지면이 수평이고 요철과 장애물이 없는 환경에서 A부터 B까지 직선 주행합니다.'}),
  Object.freeze({id:2,title:'2. 평지와 10° 경사 선택',slope:10,rough:0,obstacles:'none',path:'A → 두 노면 동시 관측 → 왼쪽 평지 선택 → B',description:'왼쪽 평지와 오른쪽 약 10° 오르막을 같은 카메라 관측에서 비교합니다. 더 완만한 평지 쪽을 선택해 주행하며 요철과 장애물은 없습니다.'}),
  Object.freeze({id:3,title:'3. 평지 + 장애물',slope:0,rough:0,obstacles:'mixed',path:'A → 평지에서 나무와 돌 우회 → B',description:'경사와 요철이 없는 평지에 나무와 돌을 유지합니다. 제공된 경로를 따라 장애물을 우회합니다.'}),
  Object.freeze({id:4,title:'4. 25° 급경사에서 정지',slope:25,rough:.04,obstacles:'none',path:'A → 요철 → 25° 경사 진입 전 정지',description:'장애물 없이 X 6m부터 기본 25° 오르막이 시작됩니다. 주행 가능한 경사 한계 20°를 넘는 전방 지면을 점군에서 확인하면 진입 전에 정지합니다.'})
]);

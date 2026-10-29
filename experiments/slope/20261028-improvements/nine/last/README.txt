마지막 ROS bag 9가지 조건 비교, 2026-10-29
원본: mapping_ws/bag_sessions/20261028_103814_3049a7. bag_identity.json의 SHA256 참조.
결과: comparison.html. 인터넷 연결 없이 열 수 있다.
재현: 프로젝트 루트에서
export NINE_BAG_SESSION=20261028_103814_3049a7
export NINE_BAG_OUTPUT=bag_nine_comparison_20261029
source mapping_ws_no_start_z_optimized/env.sh
"$MAPPING_PYTHON" work/compare_nine_bag_20261029.py
"$MAPPING_PYTHON" work/analyze_nine_bag_20261029.py
"$MAPPING_PYTHON" work/render_nine_bag_20261029.py
기존 결과가 있으면 이어서 실행하므로 새 시간 측정은 별도 출력 폴더를 사용한다.
소스: source_snapshot/과 위 work 스크립트. 운영 코드를 변경하지 않는다.
시간: 동일한 정규 0.5초 구간 111회 x 3회. 마지막 부분 tick 제외.
진단: 10초 이후 정규 tick 92회. 충돌/점 부족은 독립 검사로 중복됨.
공통 공간: 세계 좌표 3cm 중심을 엄격 전방 ROI로 제한하고, 세 해상도의 부모 셀이 모두 과거 관측되어 현재 ROI 집계에 포함되는 위치. 부모 셀 지표를 복제한 위치 표본이며 독립 점 측정/정답이 아니다.
해상도별 셀과 시각 집계, 공통 위치 집계, 최종 누적 셀 거절 집계를 서로 혼동하지 않는다.
누적 시간은 원시점 보관 시간이다. 과거 셀 높이/경사와 전체 경로의 누적 지도는 그대로 유지될 수 있다.
실제 기울기 정답, 작은 장애물 보존률, 지면 분류 성능은 측정하지 않았다.
단일 bag 결과이며 실시간 센서/VIO/깊이 동시 실행 성능은 검증하지 않았다.

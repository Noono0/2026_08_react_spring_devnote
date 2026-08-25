# Diagram Designer

ERD·순서도·시스템 구성도를 브라우저에서 그리고, 저장하고, 버전으로 되돌리는 기능입니다.
`/utilities/diagrams` 에서 사용할 수 있습니다.

---

## 사용한 오픈소스

| 라이브러리 | 버전 | 라이선스 | 사용 목적 | 프로젝트 내 위치 |
|---|---|---|---|---|
| [@xyflow/react](https://reactflow.dev) (React Flow) | 12.11.3 | MIT | 노드·엣지 캔버스, 드래그 편집, 미니맵·줌 컨트롤 | `features/utility/diagrams/components/DiagramCanvas.tsx`, `TableNode.tsx` |
| [html-to-image](https://github.com/bubkoo/html-to-image) | 1.11.13 | MIT | 캔버스 DOM을 PNG·SVG로 변환해 내려받기 | `features/utility/diagrams/pages/DiagramEditorPage.tsx` |

라이선스는 설치 전 npm 레지스트리 메타데이터로 직접 확인했습니다. 둘 다 MIT입니다.

### draw.io 대신 React Flow를 고른 이유

요구사항에는 draw.io embed가 후보로 있었지만 React Flow를 선택했습니다.

1. **기존 자산을 재사용할 수 있다.** 이 프로젝트에는 이미 `sqlSchemaAnalyzer.ts`(DDL 파서)가 있습니다.
   React Flow는 React 컴포넌트라 파서 결과를 노드로 바로 변환할 수 있지만,
   draw.io는 iframe이라 XML 프로토콜을 거쳐야 합니다.
2. **디자인 시스템이 그대로 적용된다.** 테이블 노드가 평범한 React 컴포넌트이므로
   프로젝트의 CSS 변수와 다크모드가 자동으로 따라옵니다. iframe이면 별도 테마 작업이 필요합니다.
3. **번들 영향이 예측 가능하다.** `lazy()`로 분리해 다이어그램을 쓰지 않는 사용자는 내려받지 않습니다.

Mermaid는 텍스트 → 그림 방향만 지원해 "드래그 편집"이 불가능하므로 편집기로는 쓰지 않았습니다.
다만 기존 `SqlSchemaErdPage`의 Mermaid 텍스트 내보내기는 그대로 유지됩니다.

---

## Architecture

```
Browser
 ├ React Flow 캔버스        노드 드래그·관계 연결·미니맵
 ├ sqlSchemaAnalyzer        CREATE TABLE DDL 파싱          (기존 자산 재사용)
 ├ diagramModel             SQL ↔ ERD 양방향 변환          (순수 함수, 12개 테스트)
 └ html-to-image            PNG·SVG 내보내기

        ↓ REST API (JSON)

Spring Boot
 ├ DiagramController        /api/v1/diagrams
 ├ DiagramService           소유권 검증 · 낙관적 잠금 · 이력 정책
 ├ DiagramDao (MyBatis)     DiagramMapper.xml
 └ CurrentMemberProvider    기존 세션 인증 그대로 사용

        ↓

MySQL
 ├ diagrams                 diagram_model JSON, version_number
 └ diagram_versions         변경 이력 (최근 30개 보관)
```

**핵심 원칙: 연산은 브라우저에서, 서버는 저장만 합니다.**
DDL 파싱, 레이아웃 계산, 이미지 변환은 전부 클라이언트에서 처리합니다.
서버는 JSON 문자열을 받아 저장하고 돌려줄 뿐이며, 모델 내부 구조를 해석하지 않습니다.

---

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/v1/diagrams` | 목록 (검색·종류 필터·페이징, 모델 JSON 제외) |
| GET | `/api/v1/diagrams/{diagramId}` | 상세 (모델 JSON 포함) |
| POST | `/api/v1/diagrams` | 생성 |
| PUT | `/api/v1/diagrams/{diagramId}` | 수정 (낙관적 잠금) |
| DELETE | `/api/v1/diagrams/{diagramId}` | 삭제 (soft delete) |
| GET | `/api/v1/diagrams/{diagramId}/versions` | 버전 목록 (모델 JSON 제외) |
| GET | `/api/v1/diagrams/{diagramId}/versions/{versionNumber}` | 특정 버전 (모델 JSON 포함) |
| POST | `/api/v1/diagrams/{diagramId}/versions/{versionNumber}/restore` | 이전 버전으로 복원 |

응답은 기존 `ApiResponse` 봉투를, 오류는 `ErrorCode` 규약을 그대로 따릅니다.
추가된 오류 코드: `DIAGRAM_NOT_FOUND`, `DIAGRAM_VERSION_CONFLICT`,
`DIAGRAM_MODEL_INVALID`, `DIAGRAM_VERSION_NOT_FOUND`.

---

## DB

```sql
diagrams          diagram_id, member_id, diagram_title, diagram_description,
                  diagram_type, diagram_model(JSON), version_number,
                  use_yn, deleted_at, created_at, updated_at

diagram_versions  diagram_version_id, diagram_id, version_number,
                  diagram_title, diagram_type, diagram_model(JSON),
                  change_summary, changed_by, created_at
```

### 설계 판단과 이유

**노드·엣지를 별도 테이블로 정규화하지 않고 JSON 한 칸에 담았습니다.**
다이어그램은 "통째로 읽고 통째로 저장"하는 사용 패턴이라, 정규화하면 저장할 때마다
delete-insert가 필요하고 조회에 JOIN이 늘어납니다. 기존 `documents.content_json`과 같은 방식입니다.
대신 "특정 컬럼명을 가진 테이블 검색" 같은 쿼리는 할 수 없습니다 — 현재 요구사항에 없어 감수했습니다.

**이력은 "저장할 때마다"가 아니라 "내용이 바뀔 때만" 남깁니다.**
노드를 조금 옮기고 저장을 반복해도 이력이 쌓이지 않습니다.
또한 다이어그램당 최근 30개까지만 보관하고 오래된 것은 정리합니다(`MAX_KEPT_VERSIONS`).
모델 JSON 하나가 수십 KB일 수 있어, 제한이 없으면 무료티어 DB 용량을 빠르게 소모합니다.

**남의 다이어그램 접근은 403이 아니라 404로 응답합니다.**
403은 "그 id의 데이터가 존재한다"는 사실을 알려주는 셈이라,
id를 훑어 남의 데이터 존재 여부를 알아내는 데 쓰일 수 있습니다.

---

## SQL ↔ ERD 연동

```
CREATE TABLE DDL ──analyzeSqlSchema()──▶ SqlSchemaModel
                 ──convertSqlSchemaToDiagramModel()──▶ DiagramModel ──▶ 캔버스

DiagramModel ──generateCreateTableSql()──▶ CREATE TABLE DDL
```

DDL 파서는 새로 만들지 않고 기존 `features/utility/utils/sqlSchemaAnalyzer.ts`를 재사용했습니다.
변환 로직은 전부 순수 함수라 화면 없이 테스트합니다(`diagramModel.test.ts`, 12개).
왕복 변환(DDL → ERD → DDL → ERD) 후에도 테이블과 관계가 유지되는지도 검증합니다.

ERD → DDL 생성은 인덱스·기본값·CHECK 제약을 만들지 않습니다.
편집기 모델에 없는 정보이며, ERD의 목적은 구조 설계이지 완전한 마이그레이션 스크립트 작성이 아니라고 보았습니다.

---

## AWS 저사양 서버 배포 시 고려사항

**서버 CPU/RAM 부담이 거의 없습니다.**
파싱·레이아웃·이미지 변환이 전부 브라우저에서 일어나고, 서버는 JSON 문자열을 DB에 넣고 빼는 일만 합니다.
헤드리스 브라우저나 렌더링 엔진이 필요 없습니다.

**응답 크기를 의도적으로 줄였습니다.**
목록과 버전 목록에서는 모델 JSON을 빼고 내려보냅니다.
버전이 30개면 모델도 30개가 실려 응답이 수 MB가 될 수 있기 때문입니다.

**프론트엔드 번들이 커지지 않았습니다.**
`lazy()` 분리 덕분에 메인 청크는 975.50 KB → 976.60 KB로 약 1 KB만 늘었습니다.
React Flow와 html-to-image는 202 KB(gzip 67 KB)짜리 별도 청크로 빠져,
다이어그램 화면에 들어갈 때만 내려받습니다.

**저장 공간이 무한정 늘지 않습니다.**
이력 보관 개수 제한과 중복 저장 스킵으로 다이어그램당 최대 이력 수가 고정됩니다.

---

## 아직 구현하지 않은 것

- **노드 편집 UI**: 테이블명·컬럼 추가/수정은 현재 SQL 붙여넣기로만 가능합니다.
  캔버스에서 직접 컬럼을 편집하는 인라인 폼이 있으면 좋습니다.
- **버전 미리보기**: 버전 목록에서 바로 복원할 수 있지만, 복원 전에 그 버전을 캔버스로 미리 보는 화면은 없습니다.
  (`useDiagramVersionQuery` 훅은 준비되어 있어 화면만 붙이면 됩니다.)
- **AI 자연어 → ERD**: 요구사항 Priority 4. 미구현입니다.
- **Developer Workspace (Monaco)**: 요구사항 Priority 2. 미구현입니다.

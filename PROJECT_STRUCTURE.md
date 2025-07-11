# 라이더 정산 프로그램 - 프로젝트 구조 분석

## 📁 프로젝트 개요
- **프로젝트명**: 라이더 정산 프로그램
- **개발 언어**: HTML, CSS, JavaScript (순수 웹 기술)
- **목적**: 엑셀 파일 기반 라이더 정산 데이터 관리 및 조회 시스템

## 🗂️ 파일 구조

```
bjungsang/
├── index.html          # 메인 HTML 파일 (5.4KB, 107 lines)
├── script.js           # 메인 JavaScript 파일 (37KB, 803 lines)
├── styles.css          # 스타일시트 (11KB, 626 lines)
├── .gitignore          # Git 무시 파일
├── .git/               # Git 저장소
└── .history/           # 파일 변경 히스토리
```

## 📋 주요 기능

### 1. 파일 업로드 및 데이터 처리
- **엑셀 파일 업로드**: 드래그 앤 드롭 또는 파일 선택
- **지원 형식**: .xlsx, .xls
- **타겟 시트**: '을지_협력사 소속 라이더 정산 확인용'
- **데이터 파싱**: 20행부터 시작하여 라이더 정보 추출

### 2. 라이더 정산 데이터 관리
- **기본 정보**: 라이더 ID, 라이더명, 처리건수
- **배달료 정보**: 배달료, 추가할증, 지점프로모션
- **공제 항목**: 고용보험, 산재보험, 시급보험, 수수료, 리스비
- **계산 항목**: 총 배달료, 정산금액, 원천징수세액, 최종 지급액

### 3. 정산 계산 로직
```javascript
// 총 배달료 = 배달료 + 추가할증 + 지점프로모션 - 수수료
totalDeliveryFee = deliveryFee + additionalPayment + branchPromotion - commission

// 라이더 정산금액 = 총 배달료 - 공제성 항목들
settlementAmount = totalDeliveryFee - totalDeductions

// 원천징수세액 = 총 배달료 × 3.3%
withholdingTax = totalDeliveryFee × 0.033

// 최종 지급액 = 라이더 정산금액 - 원천징수세액 - 리스비
finalPayment = settlementAmount - withholdingTax - rebate
```

### 4. 사용자 인터페이스
- **전체 데이터 보기**: 테이블 형태로 모든 라이더 정산 현황 표시
- **개별 라이더 조회**: 드롭다운으로 특정 라이더 선택하여 상세 정보 확인
- **수수료 일괄 입력**: 건당 50원~500원 범위에서 선택 가능
- **스크린샷 저장**: 개별 또는 전체 라이더 정산 내역 이미지 저장

### 5. 반응형 디자인
- **데스크탑 최적화**: 최대 1600px 컨테이너
- **태블릿 지원**: 1024px 이하 대응
- **모바일 지원**: 768px 이하 대응

## 🛠️ 사용 기술

### 외부 라이브러리
- **xlsx.js**: 엑셀 파일 읽기/쓰기 (CDN: 0.18.5 버전)
- **html2canvas**: 스크린샷 생성 (CDN: 1.4.1 버전)

### 주요 JavaScript 함수
- `parseExcelFile()`: 엑셀 파일 파싱
- `displayRiderInfo()`: 라이더 정보 표시
- `saveScreenshot()`: 스크린샷 저장
- `applyBulkCommission()`: 수수료 일괄 적용
- `updateRiderData()`: 라이더 데이터 업데이트

### CSS 특징
- **그라데이션 디자인**: 보라색 계열 배경 (#667eea → #764ba2)
- **카드 기반 레이아웃**: 각 섹션을 카드 형태로 구성
- **애니메이션**: 호버 효과 및 트랜지션 적용
- **테이블 스타일링**: 정산 데이터 가독성 최적화

## 📊 현재 엑셀 파싱 구조

### 파싱 설정
```javascript
// 고정 설정값
const sheetName = '을지_협력사 소속 라이더 정산 확인용';  // 시트명 고정
const startRow = 20;  // 20행부터 데이터 시작
```

### 엑셀 열 매핑 (고정)
| 열 위치 | 데이터 필드 | 설명 |
|---------|-------------|------|
| **B열** | `id` | 라이더 ID |
| **C열** | `name` | 라이더명 |
| **D열** | `processCount` | 처리건수 |
| **E열** | `deliveryFee` | 배달료 |
| **F열** | `additionalPayment` | 추가할증 (본사 프로모션) |
| **H열** | `hourlyInsurance` | 시간제 보험료 |
| **L열** | `employmentInsurance` | 고용보험료 |
| **N열** | `accidentInsurance` | 산재보험료 |
| **Q열** | `employmentRetroactive` | 고용보험 소급정산 |
| **T열** | `accidentRetroactive` | 산재보험 소급정산 |

### 파싱 코드 구조
```javascript
function parseExcelFile(data) {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets['을지_협력사 소속 라이더 정산 확인용'];
    
    let row = 20;  // 20행부터 시작
    while (true) {
        const id = getCellValue(sheet, `B${row}`);
        const name = getCellValue(sheet, `C${row}`);
        
        // ID나 이름이 없으면 데이터 종료
        if (!id && !name) break;
        
        const riderData = {
            id: id || '',
            name: name || '',
            processCount: getCellValue(sheet, `D${row}`) || 0,
            deliveryFee: getCellValue(sheet, `E${row}`) || 0,
            additionalPayment: getCellValue(sheet, `F${row}`) || 0,
            hourlyInsurance: getCellValue(sheet, `H${row}`) || 0,
            employmentInsurance: getCellValue(sheet, `L${row}`) || 0,
            accidentInsurance: getCellValue(sheet, `N${row}`) || 0,
            employmentRetroactive: getCellValue(sheet, `Q${row}`) || 0,
            accidentRetroactive: getCellValue(sheet, `T${row}`) || 0
        };
        
        ridersData.push(riderData);
        row++;
    }
}
```

### 사용자 입력 필드 (UI에서 추가)
- **지점 프로모션**: `branchPromotion` (초기값: 빈 문자열)
- **수수료**: `commission` (초기값: 빈 문자열)
- **리스비**: `rebate` (초기값: 빈 문자열)

## 🎯 핵심 워크플로우

1. **파일 업로드**
   - 사용자가 엑셀 파일 업로드
   - 파일 검증 및 파싱
   - 라이더 데이터 추출

2. **데이터 편집**
   - 전체 라이더 목록 표시
   - 지점 프로모션, 수수료, 리스비 입력
   - 실시간 계산 결과 업데이트

3. **데이터 조회**
   - 개별 라이더 선택
   - 상세 정산 내역 표시
   - 스크린샷 저장 기능

## 📊 데이터 구조

```javascript
riderData = {
    // 엑셀에서 추출되는 데이터
    id: string,                    // 라이더 ID (B열)
    name: string,                  // 라이더명 (C열)
    processCount: number,          // 처리건수 (D열)
    deliveryFee: number,           // 배달료 (E열)
    additionalPayment: number,     // 추가할증 (F열)
    hourlyInsurance: number,       // 시급보험 (H열)
    employmentInsurance: number,   // 고용보험 (L열)
    accidentInsurance: number,     // 산재보험 (N열)
    employmentRetroactive: number, // 고용보험 소급 (Q열)
    accidentRetroactive: number,   // 산재보험 소급 (T열)
    
    // 사용자 입력 데이터
    branchPromotion: number,       // 지점프로모션 (UI 입력)
    commission: number,            // 수수료 (UI 입력)
    rebate: number,                // 리스비 (UI 입력)
    
    // 계산되는 데이터
    totalDeliveryFee: number,      // 총 배달료 (계산값)
    settlementAmount: number,      // 정산금액 (계산값)
    withholdingTax: number,        // 원천징수세액 (계산값)
    finalPayment: number           // 최종 지급액 (계산값)
}
```

---

**작성일**: 2025-07-11  
**버전**: 1.0  
**마지막 업데이트**: 2025-07-11 
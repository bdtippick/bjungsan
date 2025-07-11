let ridersData = [];
let currentFile = null;

// DOM이 로드되면 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 파일 업로드 이벤트 리스너
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    // 드래그 앤 드롭 이벤트
    const uploadZone = document.getElementById('uploadZone');
    
    uploadZone.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    currentFile = file;
    showMessage('파일을 처리 중입니다...', 'loading');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            parseExcelFile(e.target.result);
        } catch (error) {
            showMessage('파일 처리 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseExcelFile(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = '을지_협력사 소속 라이더 정산 확인용';
        
        if (!workbook.SheetNames.includes(sheetName)) {
            showMessage('지정된 시트를 찾을 수 없습니다: ' + sheetName, 'error');
            return;
        }

        const sheet = workbook.Sheets[sheetName];
        ridersData = [];

        // 데이터 파싱 (20행부터 시작)
        let row = 20;
        while (true) {
            const id = getCellValue(sheet, `B${row}`);
            const name = getCellValue(sheet, `C${row}`);
            
            // ID나 이름이 없으면 더 이상 데이터가 없다고 가정
            if (!id && !name) break;
            
            const riderData = {
                id: id || '',
                name: name || '',
                processCount: getCellValue(sheet, `D${row}`) || 0,
                deliveryFee: getCellValue(sheet, `E${row}`) || 0,
                additionalPayment: getCellValue(sheet, `F${row}`) || 0,
                branchPromotion: '', // 초기값
                commission: '', // 수수료 초기값
                rebate: '', // 리스비 초기값
                hourlyInsurance: getCellValue(sheet, `H${row}`) || 0,
                employmentInsurance: getCellValue(sheet, `L${row}`) || 0,
                accidentInsurance: getCellValue(sheet, `N${row}`) || 0,
                employmentRetroactive: getCellValue(sheet, `Q${row}`) || 0,
                accidentRetroactive: getCellValue(sheet, `T${row}`) || 0
                // settlementAmount은 계산으로 구함 (총 배달료 - 모든 공제성 항목)
            };

            // 계산된 값들
            const actualCommission = riderData.processCount * (riderData.commission || 0); // 처리건수 X 수수료 단가
            
            // 총 배달료 = 배달료 + 추가할증 + 지점프로모션 - 수수료
            riderData.totalDeliveryFee = riderData.deliveryFee + riderData.additionalPayment + (riderData.branchPromotion || 0) - actualCommission;
            
            // 공제성 항목들 (수수료 제외)
            const totalDeductions = riderData.employmentInsurance + riderData.accidentInsurance + riderData.hourlyInsurance + 
                                  riderData.employmentRetroactive + riderData.accidentRetroactive;
            
            // 라이더 정산금액 = 총 배달료 - 공제성 항목들
            riderData.settlementAmount = riderData.totalDeliveryFee - totalDeductions;
            
            // 원천징수세액 = 총 배달료 X 3.3%
            riderData.withholdingTax = riderData.totalDeliveryFee * 0.033;
            
            // 최종 지급액 = 라이더 정산금액 - 원천징수세액 - 리스비
            riderData.finalPayment = riderData.settlementAmount - riderData.withholdingTax - (riderData.rebate || 0);

            ridersData.push(riderData);
            row++;
        }

        if (ridersData.length === 0) {
            showMessage('데이터를 찾을 수 없습니다. 시트의 B20 셀부터 데이터가 있는지 확인하세요.', 'error');
            return;
        }

        showOverviewPage();
        showMessage(`성공적으로 ${ridersData.length}명의 라이더 데이터를 불러왔습니다.`, 'success');

    } catch (error) {
        showMessage('엑셀 파일 파싱 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

function getCellValue(sheet, cellRef) {
    const cell = sheet[cellRef];
    return cell ? cell.v : null;
}

function populateRiderDropdown() {
    const select = document.getElementById('riderSelect');
    select.innerHTML = '<option value="">라이더를 선택하세요</option>';
    
    ridersData.forEach((rider, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${rider.name} (ID: ${rider.id})`;
        select.appendChild(option);
    });

    select.addEventListener('change', displayRiderInfo);
}

function displayRiderInfo() {
    const selectIndex = document.getElementById('riderSelect').value;
    const infoDiv = document.getElementById('riderInfo');
    const screenshotBtn = document.querySelector('.screenshot-btn');
    
    if (selectIndex === '') {
        infoDiv.innerHTML = '';
        screenshotBtn.style.display = 'none';
        return;
    }

    const rider = ridersData[selectIndex];
    screenshotBtn.style.display = 'block';
    
    infoDiv.innerHTML = `
        <!-- 라이더 기본정보 -->
        <div class="info-table">
            <div class="table-header">라이더 기본정보</div>
            <div class="table-content">
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">라이더 ID</div>
                        <div class="cell-value info">${rider.id}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">라이더명</div>
                        <div class="cell-value info">${rider.name}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">처리건수</div>
                        <div class="cell-value info">${formatNumber(rider.processCount)}건</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 배달료 정보 -->
        <div class="info-table">
            <div class="table-header">배달료 정보</div>
            <div class="table-content">
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">배달료</div>
                        <div class="cell-value amount">${formatCurrency(rider.deliveryFee)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">추가할증</div>
                        <div class="cell-value amount">${formatCurrency(rider.additionalPayment)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">지점 프로모션</div>
                        <div class="cell-value amount">${formatCurrency(rider.branchPromotion || 0)}</div>
                    </div>
                </div>
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">수수료 (${formatNumber(rider.processCount)}건 × ${formatCurrency(rider.commission || 0)})</div>
                        <div class="cell-value ${(rider.commission || 0) > 0 ? 'deduction' : ''}">${(rider.commission || 0) > 0 ? formatDeduction(rider.processCount * rider.commission) : formatCurrency(0)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">총 배달료</div>
                        <div class="cell-value amount">${formatCurrency(rider.totalDeliveryFee)}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 공제성 항목 -->
        <div class="info-table">
            <div class="table-header">공제성 항목</div>
            <div class="table-content">
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">라이더 고용보험료</div>
                        <div class="cell-value">${formatCurrency(rider.employmentInsurance)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">라이더 산재보험료</div>
                        <div class="cell-value">${formatCurrency(rider.accidentInsurance)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">시간제 보험료</div>
                        <div class="cell-value">${formatCurrency(rider.hourlyInsurance)}</div>
                    </div>
                </div>
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">고용보험 소급정산</div>
                        <div class="cell-value">${formatCurrency(rider.employmentRetroactive)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">산재보험 소급정산</div>
                        <div class="cell-value">${formatCurrency(rider.accidentRetroactive)}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 추가 차감 항목 -->
        <div class="info-table">
            <div class="table-header">추가 차감 항목</div>
            <div class="table-content">
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">리스비</div>
                        <div class="cell-value ${(rider.rebate || 0) > 0 ? 'deduction' : ''}">${(rider.rebate || 0) > 0 ? formatDeduction(rider.rebate) : formatCurrency(rider.rebate || 0)}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 최종 정산 -->
        <div class="info-table final-payment-table">
            <div class="table-header">최종 정산</div>
            <div class="table-content">
                <div class="table-row">
                    <div class="table-cell">
                        <div class="cell-label">라이더 정산금액<br><small>(총 배달료 - 공제성 항목)</small></div>
                        <div class="cell-value amount">${formatCurrency(rider.settlementAmount)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">원천징수세액<br><small>(총 배달료 × 3.3%)</small></div>
                        <div class="cell-value tax">${formatCurrency(rider.withholdingTax)}</div>
                    </div>
                    <div class="table-cell">
                        <div class="cell-label">라이더 지급액<br><small>(정산금액 - 원천징수세액 - 리스비)</small></div>
                        <div class="cell-value final">${formatCurrency(rider.finalPayment)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function formatNumber(num) {
    return new Intl.NumberFormat('ko-KR').format(num);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원';
}

function formatDeduction(amount) {
    const roundedAmount = Math.round(amount);
    if (roundedAmount === 0) {
        return '0원';
    }
    return '-' + new Intl.NumberFormat('ko-KR').format(roundedAmount) + '원';
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    let className = '';
    let icon = '';
    
    switch (type) {
        case 'loading':
            className = 'loading';
            icon = '<div class="loading-spinner"></div>';
            break;
        case 'error':
            className = 'error';
            icon = '❌ ';
            break;
        case 'success':
            className = 'success';
            icon = '✅ ';
            break;
        default:
            className = '';
            icon = '';
    }
    
    messageDiv.innerHTML = `<div class="${className}">${icon}${message}</div>`;
    
    // 성공 메시지는 3초 후 자동으로 사라짐
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }
}

// 전체 데이터 보기 페이지 표시
function showOverviewPage() {
    document.getElementById('overviewSection').style.display = 'block';
    document.getElementById('dataSection').style.display = 'none';
    createOverviewTable();
}

// 개별 조회 페이지 표시
function showIndividualPage() {
    document.getElementById('overviewSection').style.display = 'none';
    document.getElementById('dataSection').style.display = 'block';
    populateRiderDropdown();
}

// 전체 데이터 테이블 생성
function createOverviewTable() {
    const tableBody = document.getElementById('overviewTableBody');
    tableBody.innerHTML = '';
    
    ridersData.forEach((rider, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rider.id}</td>
            <td>${rider.name}</td>
            <td>${formatNumber(rider.processCount)}건</td>
            <td class="amount">${formatCurrency(rider.deliveryFee)}</td>
            <td class="amount">${formatCurrency(rider.additionalPayment)}</td>
            <td>
                <input type="number" class="input-field" id="branchPromotion_${index}" 
                       value="${rider.branchPromotion || ''}" min="0" step="100" placeholder="0"
                       onchange="updateRiderData(${index}, 'branchPromotion', this.value)">
            </td>
            <td class="amount">${formatCurrency(rider.totalDeliveryFee)}</td>
            <td>
                <input type="number" class="input-field deduction" id="commission_${index}" 
                       value="${rider.commission || ''}" min="0" step="50" placeholder="건당 0원"
                       onchange="updateRiderData(${index}, 'commission', this.value)">
            </td>
            <td>
                <input type="number" class="input-field deduction" id="rebate_${index}" 
                       value="${rider.rebate || ''}" min="0" step="100" placeholder="0"
                       onchange="updateRiderData(${index}, 'rebate', this.value)">
            </td>
            <td class="amount">${formatCurrency(rider.settlementAmount)}</td>
            <td class="tax">${formatCurrency(rider.withholdingTax)}</td>
            <td class="final">${formatCurrency(rider.finalPayment)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 라이더 데이터 업데이트
function updateRiderData(index, field, value) {
    const numValue = parseFloat(value) || 0;
    ridersData[index][field] = numValue;
    
    // 총 배달료 재계산 (배달료 + 본사 프로모션 + 지점 프로모션 - 수수료)
    const actualCommission = ridersData[index].processCount * (ridersData[index].commission || 0); // 처리건수 X 수수료 단가
    ridersData[index].totalDeliveryFee = ridersData[index].deliveryFee + 
                                         ridersData[index].additionalPayment + 
                                         (ridersData[index].branchPromotion || 0) - 
                                         actualCommission;
    
    // 공제성 항목들 (수수료 제외)
    const totalDeductions = ridersData[index].employmentInsurance + ridersData[index].accidentInsurance + ridersData[index].hourlyInsurance + 
                          ridersData[index].employmentRetroactive + ridersData[index].accidentRetroactive;
    
    // 라이더 정산금액 = 총 배달료 - 공제성 항목들
    ridersData[index].settlementAmount = ridersData[index].totalDeliveryFee - totalDeductions;
    
    // 원천징수세액 = 총 배달료 X 3.3%
    ridersData[index].withholdingTax = ridersData[index].totalDeliveryFee * 0.033;
    
    // 최종 지급액 = 라이더 정산금액 - 원천징수세액 - 리스비
    ridersData[index].finalPayment = ridersData[index].settlementAmount - ridersData[index].withholdingTax - (ridersData[index].rebate || 0);
    
    // 테이블 업데이트
    const row = document.getElementById('overviewTableBody').children[index];
    row.cells[6].innerHTML = `<span class="amount">${formatCurrency(ridersData[index].totalDeliveryFee)}</span>`;
    row.cells[9].innerHTML = `<span class="amount">${formatCurrency(ridersData[index].settlementAmount)}</span>`;
    row.cells[10].innerHTML = `<span class="tax">${formatCurrency(ridersData[index].withholdingTax)}</span>`;
    row.cells[11].innerHTML = `<span class="final">${formatCurrency(ridersData[index].finalPayment)}</span>`;
}

// 모든 데이터 저장하고 개별 조회로 이동
function saveAllData() {
    // 모든 라이더의 기본값 설정
    ridersData.forEach(rider => {
        if (!rider.branchPromotion) rider.branchPromotion = '';
        if (!rider.commission) rider.commission = '';
        if (!rider.rebate) rider.rebate = '';
    });
    
    showMessage('데이터가 저장되었습니다!', 'success');
    showIndividualPage();
}

// 전체 보기로 돌아가기
function goBackToOverview() {
    showOverviewPage();
}

// 수수료 일괄 입력
function applyBulkCommission() {
    const commissionValue = document.getElementById('bulkCommission').value;
    
    if (!commissionValue) return;
    
    const numValue = parseFloat(commissionValue);
    
    // 모든 라이더에게 수수료 적용
    ridersData.forEach((rider, index) => {
        rider.commission = numValue;
        
        // 총 배달료 재계산
        const actualCommission = rider.processCount * (rider.commission || 0); // 처리건수 X 수수료 단가
        rider.totalDeliveryFee = rider.deliveryFee + rider.additionalPayment + (rider.branchPromotion || 0) - actualCommission;
        
        // 공제성 항목들 (수수료 제외)
        const totalDeductions = rider.employmentInsurance + rider.accidentInsurance + rider.hourlyInsurance + 
                              rider.employmentRetroactive + rider.accidentRetroactive;
        
        // 라이더 정산금액 = 총 배달료 - 공제성 항목들
        rider.settlementAmount = rider.totalDeliveryFee - totalDeductions;
        
        // 원천징수세액 = 총 배달료 X 3.3%
        rider.withholdingTax = rider.totalDeliveryFee * 0.033;
        
        // 최종 지급액 = 라이더 정산금액 - 원천징수세액 - 리스비
        rider.finalPayment = rider.settlementAmount - rider.withholdingTax - (rider.rebate || 0);
        
        // 입력 필드 업데이트
        const commissionInput = document.getElementById(`commission_${index}`);
        if (commissionInput) {
            commissionInput.value = numValue;
        }
    });
    
    // 테이블 다시 생성
    createOverviewTable();
    
    // 드롭다운 초기화
    document.getElementById('bulkCommission').value = '';
    
    showMessage(`모든 라이더에게 수수료 단가 ${commissionValue}원이 적용되었습니다. (실제 수수료는 처리건수 × 단가로 계산되며, 총 배달료에서 차감됩니다)`, 'success');
}

// 스크린샷 저장 함수
function saveScreenshot() {
    const selectIndex = document.getElementById('riderSelect').value;
    
    if (selectIndex === '') {
        showMessage('라이더를 선택해주세요.', 'error');
        return;
    }

    const rider = ridersData[selectIndex];
    const riderInfoDiv = document.getElementById('riderInfo');
    
    if (!riderInfoDiv.innerHTML) {
        showMessage('라이더 정보를 먼저 표시해주세요.', 'error');
        return;
    }
    
    showMessage('스크린샷을 생성하고 있습니다...', 'loading');
    
    // html2canvas를 사용하여 라이더 정보 영역을 캡처
    html2canvas(riderInfoDiv, {
        backgroundColor: '#ffffff',
        scale: 2, // 고해상도로 캡처
        useCORS: true,
        allowTaint: true,
        width: riderInfoDiv.scrollWidth,
        height: riderInfoDiv.scrollHeight
    }).then(canvas => {
        // 캔버스를 이미지로 변환
        const imgData = canvas.toDataURL('image/png');
        const fileName = `라이더정산_${rider.name}_${rider.id}.png`;
        
        // File System Access API 지원 확인
        if ('showSaveFilePicker' in window) {
            saveWithFilePicker(imgData, fileName, rider);
        } else {
            // 기본 다운로드 방식
            saveWithDownloadLink(imgData, fileName, rider);
        }
    }).catch(error => {
        console.error('스크린샷 생성 중 오류 발생:', error);
        showMessage('스크린샷 저장 중 오류가 발생했습니다.', 'error');
    });
}

// File System Access API를 사용한 저장 (폴더 선택 가능)
async function saveWithFilePicker(imgData, fileName, rider) {
    try {
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{
                description: 'PNG 이미지',
                accept: { 'image/png': ['.png'] }
            }]
        });
        
        // Base64를 Blob으로 변환
        const response = await fetch(imgData);
        const blob = await response.blob();
        
        // 파일 쓰기
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        showMessage(`${rider.name} 라이더의 정산 정보가 지정한 위치에 저장되었습니다.`, 'success');
    } catch (error) {
        if (error.name === 'AbortError') {
            showMessage('저장이 취소되었습니다.', 'error');
        } else {
            console.error('파일 저장 중 오류:', error);
            // 오류 시 기본 다운로드 방식으로 대체
            saveWithDownloadLink(imgData, fileName, rider);
        }
    }
}

// 기본 다운로드 링크 방식
function saveWithDownloadLink(imgData, fileName, rider) {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = imgData;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage(`${rider.name} 라이더의 정산 정보가 다운로드 폴더에 저장되었습니다.`, 'success');
}

// 전체 라이더 스크린샷 저장
async function saveAllScreenshots() {
    if (ridersData.length === 0) {
        showMessage('라이더 데이터가 없습니다.', 'error');
        return;
    }
    
    showMessage(`전체 ${ridersData.length}명의 라이더 스크린샷을 생성하고 있습니다...`, 'loading');
    
    try {
        // File System Access API 지원 확인
        let directoryHandle = null;
        if ('showDirectoryPicker' in window) {
            try {
                directoryHandle = await window.showDirectoryPicker();
            } catch (error) {
                if (error.name === 'AbortError') {
                    showMessage('폴더 선택이 취소되었습니다.', 'error');
                    return;
                }
                console.log('폴더 선택 실패, 기본 다운로드 방식 사용');
            }
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // 각 라이더별로 스크린샷 생성
        for (let i = 0; i < ridersData.length; i++) {
            const rider = ridersData[i];
            
            try {
                // 임시로 라이더 정보 생성
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = generateRiderInfoHTML(rider);
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.style.width = '1200px';
                tempDiv.style.backgroundColor = '#ffffff';
                tempDiv.style.padding = '20px';
                document.body.appendChild(tempDiv);
                
                // 스크린샷 생성
                const canvas = await html2canvas(tempDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    width: tempDiv.scrollWidth,
                    height: tempDiv.scrollHeight
                });
                
                const imgData = canvas.toDataURL('image/png');
                const fileName = `라이더정산_${rider.name}_${rider.id}.png`;
                
                // 파일 저장
                if (directoryHandle) {
                    await saveToDirectory(directoryHandle, imgData, fileName);
                } else {
                    await saveWithDownloadLinkAsync(imgData, fileName);
                }
                
                document.body.removeChild(tempDiv);
                successCount++;
                
                // 진행률 표시
                showMessage(`진행 중... (${i + 1}/${ridersData.length})`, 'loading');
                
            } catch (error) {
                console.error(`${rider.name} 스크린샷 생성 실패:`, error);
                failCount++;
                if (document.body.contains(tempDiv)) {
                    document.body.removeChild(tempDiv);
                }
            }
        }
        
        // 결과 메시지
        if (successCount === ridersData.length) {
            showMessage(`모든 라이더(${successCount}명)의 스크린샷이 저장되었습니다.`, 'success');
        } else {
            showMessage(`${successCount}명 저장 완료, ${failCount}명 실패했습니다.`, 'error');
        }
        
    } catch (error) {
        console.error('전체 스크린샷 저장 중 오류:', error);
        showMessage('전체 스크린샷 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 디렉토리에 파일 저장
async function saveToDirectory(directoryHandle, imgData, fileName) {
    const response = await fetch(imgData);
    const blob = await response.blob();
    
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

// 비동기 다운로드 링크 방식
function saveWithDownloadLinkAsync(imgData, fileName) {
    return new Promise((resolve) => {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = imgData;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 다운로드 간격 조절
        setTimeout(resolve, 500);
    });
}

// 라이더 정보 HTML 생성 함수
function generateRiderInfoHTML(rider) {
    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
            <!-- 라이더 기본정보 -->
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; text-align: center; font-weight: 600; margin-bottom: 1rem;">라이더 기본정보</div>
                <div style="display: flex; gap: 2rem; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">라이더 ID</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #2d3748;">${rider.id}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">라이더명</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #2d3748;">${rider.name}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">처리건수</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #2d3748;">${formatNumber(rider.processCount)}건</div>
                    </div>
                </div>
            </div>

            <!-- 배달료 정보 -->
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; text-align: center; font-weight: 600; margin-bottom: 1rem;">배달료 정보</div>
                <div style="display: flex; gap: 2rem; justify-content: space-around; margin-bottom: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">배달료</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #48bb78;">${formatCurrency(rider.deliveryFee)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">추가할증</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #48bb78;">${formatCurrency(rider.additionalPayment)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">지점 프로모션</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #48bb78;">${formatCurrency(rider.branchPromotion || 0)}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 2rem; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">수수료 (${formatNumber(rider.processCount)}건 × ${formatCurrency(rider.commission || 0)})</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: ${(rider.commission || 0) > 0 ? '#e53e3e' : '#4a5568'};">${(rider.commission || 0) > 0 ? formatDeduction(rider.processCount * rider.commission) : formatCurrency(0)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">총 배달료</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #48bb78;">${formatCurrency(rider.totalDeliveryFee)}</div>
                    </div>
                </div>
            </div>

            <!-- 공제성 항목 -->
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; text-align: center; font-weight: 600; margin-bottom: 1rem;">공제성 항목</div>
                <div style="display: flex; gap: 2rem; justify-content: space-around; margin-bottom: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">라이더 고용보험료</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #4a5568;">${formatCurrency(rider.employmentInsurance)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">라이더 산재보험료</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #4a5568;">${formatCurrency(rider.accidentInsurance)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">시간제 보험료</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #4a5568;">${formatCurrency(rider.hourlyInsurance)}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 2rem; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">고용보험 소급정산</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #4a5568;">${formatCurrency(rider.employmentRetroactive)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">산재보험 소급정산</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #4a5568;">${formatCurrency(rider.accidentRetroactive)}</div>
                    </div>
                </div>
            </div>

            <!-- 추가 차감 항목 -->
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; text-align: center; font-weight: 600; margin-bottom: 1rem;">추가 차감 항목</div>
                <div style="display: flex; gap: 2rem; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; color: #4a5568; margin-bottom: 0.5rem;">리스비</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: ${(rider.rebate || 0) > 0 ? '#e53e3e' : '#4a5568'};">${(rider.rebate || 0) > 0 ? formatDeduction(rider.rebate) : formatCurrency(rider.rebate || 0)}</div>
                    </div>
                </div>
            </div>

            <!-- 최종 정산 -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <div style="text-align: center; font-weight: 600; margin-bottom: 1rem; font-size: 1.1rem;">최종 정산</div>
                <div style="display: flex; gap: 2rem; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.9;">라이더 정산금액</div>
                        <div style="font-size: 0.8rem; margin-bottom: 0.3rem; opacity: 0.8;">(총 배달료 - 공제성 항목)</div>
                        <div style="font-size: 1.2rem; font-weight: 600;">${formatCurrency(rider.settlementAmount)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.9;">원천징수세액</div>
                        <div style="font-size: 0.8rem; margin-bottom: 0.3rem; opacity: 0.8;">(총 배달료 × 3.3%)</div>
                        <div style="font-size: 1.2rem; font-weight: 600;">${formatCurrency(rider.withholdingTax)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.9;">라이더 지급액</div>
                        <div style="font-size: 0.8rem; margin-bottom: 0.3rem; opacity: 0.8;">(정산금액 - 원천징수세액 - 리스비)</div>
                        <div style="font-size: 1.4rem; font-weight: 700;">${formatCurrency(rider.finalPayment)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
} 
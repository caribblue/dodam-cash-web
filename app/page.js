'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [view, setView] = useState('dashboard'); // 기본 뷰를 대시보드로 지정
  const [ledgers, setLedgers] = useState([]);
  const [currentEditId, setCurrentEditId] = useState(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState(null);

  const [customAccounts, setCustomAccounts] = useState({
    asset: ['주계좌(카뱅)', '미수금', '보증금'],
    liability: ['대출금', '신용카드'],
    equity: ['기초잔액', '자본금', '인출금'],
    revenue: ['수학수강료매출', '영어수강료매출', '교재비수익'],
    expense: ['강사료(3.3%)', '교재구입비', '임대료', '지급수수료(카드)', '광고홍보비', '소모품비', '로열티비용', '임차료']
  });

  const [filterStartDate, setFilterStartDate] = useState('2026-06-01');
  const [filterEndDate, setFilterEndDate] = useState('2026-06-30');
  const [quickYear, setQuickYear] = useState('2026');
  const [quickQuarter, setQuickQuarter] = useState('');
  const [quickMonth, setQuickMonth] = useState('6');

  const [transDate, setTransDate] = useState('');
  const [transItem, setTransItem] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transDebit, setTransDebit] = useState('');
  const [transCredit, setTransCredit] = useState('');
  const [transMemo, setTransMemo] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadLedgerData(currentUser.uid);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadLedgerData = async (uid) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ledgers) setLedgers(data.ledgers);
        if (data.customAccounts) setCustomAccounts(data.customAccounts);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const saveToDB = async (newLedgers, newAccounts = customAccounts) => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(docRef, { ledgers: newLedgers, customAccounts: newAccounts });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = () => {
    if (!email || !password) return alert("이메일과 비밀번호를 입력해주세요.");
    signInWithEmailAndPassword(auth, email, password).catch(err => alert("로그인 실패: " + err.message));
  };

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) signOut(auth);
  };

  const addTransaction = () => {
    if (!transDate || !transItem || !transAmount || !transDebit || !transCredit) {
      return alert("날짜, 아이템, 금액, 왼쪽, 오른쪽 항목은 필수입니다.");
    }
    let updatedLedgers = [...ledgers];
    if (currentEditId) {
      updatedLedgers = updatedLedgers.map(t => t.id === currentEditId ? {
        ...t, date: transDate, item: transItem, amount: Number(transAmount), debit: transDebit, credit: transCredit, memo: transMemo
      } : t);
      setCurrentEditId(null);
    } else {
      updatedLedgers.push({
        id: Date.now().toString(), date: transDate, item: transItem, amount: Number(transAmount), debit: transDebit, credit: transCredit, memo: transMemo
      });
    }
    setLedgers(updatedLedgers);
    saveToDB(updatedLedgers);
    setTransItem(''); setTransAmount(''); setTransDebit(''); setTransCredit(''); setTransMemo('');
  };

  const editTransaction = (id) => {
    const target = ledgers.find(t => t.id === id);
    if (!target) return;
    setTransDate(target.date); setTransItem(target.item); setTransAmount(target.amount);
    setTransDebit(target.debit); setTransCredit(target.credit); setTransMemo(target.memo || '');
    setCurrentEditId(id);
    setView('transaction');
  };

  const deleteTransaction = (id) => {
    if (confirm("이 거래 내역을 삭제하시겠습니까?")) {
      const updated = ledgers.filter(t => t.id !== id);
      setLedgers(updated);
      saveToDB(updated);
    }
  };

  const getAccountCategory = (accountName) => {
    if (!accountName) return 'unknown';
    if (customAccounts.asset.some(acc => accountName === acc)) return 'asset';
    if (customAccounts.liability.some(acc => accountName === acc)) return 'liability';
    if (customAccounts.equity.some(acc => accountName === acc)) return 'equity';
    if (customAccounts.revenue.some(acc => accountName === acc)) return 'revenue';
    if (customAccounts.expense.some(acc => accountName === acc)) return 'expense';
    return 'unknown';
  };

  const addAccount = (category) => {
    const newAcc = prompt("새로운 계정과목 이름을 입력하세요:");
    if (newAcc && newAcc.trim() !== '') {
      if (customAccounts[category].includes(newAcc.trim())) return alert("이미 존재하는 계정과목입니다.");
      const updatedAccounts = { ...customAccounts, [category]: [...customAccounts[category], newAcc.trim()] };
      setCustomAccounts(updatedAccounts);
      saveToDB(ledgers, updatedAccounts);
    }
  };

  const deleteAccount = (category, accName) => {
    if (confirm(`'${accName}' 계정과목을 삭제하시겠습니까?`)) {
      const updatedAccounts = { ...customAccounts, [category]: customAccounts[category].filter(name => name !== accName) };
      setCustomAccounts(updatedAccounts);
      saveToDB(ledgers, updatedAccounts);
    }
  };

  const allAccounts = [
    ...customAccounts.asset, ...customAccounts.liability,
    ...customAccounts.equity, ...customAccounts.revenue, ...customAccounts.expense
  ];

  const applyQuickDate = (type, yearVal, qtrVal, monthVal) => {
    let start = '', end = '';
    if (type === 'year') {
      setQuickQuarter(''); setQuickMonth('');
      start = `${yearVal}-01-01`; end = `${yearVal}-12-31`;
    } else if (type === 'quarter' && qtrVal) {
      setQuickMonth('');
      const startMonth = (qtrVal - 1) * 3 + 1; const endMonth = qtrVal * 3;
      start = `${yearVal}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(yearVal, endMonth, 0).getDate();
      end = `${yearVal}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
    } else if (type === 'month' && monthVal) {
      setQuickQuarter('');
      start = `${yearVal}-${String(monthVal).padStart(2, '0')}-01`;
      const lastDay = new Date(yearVal, monthVal, 0).getDate();
      end = `${yearVal}-${String(monthVal).padStart(2, '0')}-${lastDay}`;
    }
    if (start && end) { setFilterStartDate(start); setFilterEndDate(end); }
  };

  const exportToExcel = () => {
    if (ledgers.length === 0) return alert("내보낼 데이터가 없습니다.");
    let csv = '날짜,아이템,금액,왼쪽,오른쪽,비고\n';
    ledgers.forEach(t => {
      csv += [t.date, `"${t.item}"`, t.amount, `"${t.debit}"`, `"${t.credit}"`, `"${t.memo || ''}"`].join(',') + '\n';
    });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "도담캐시_백업.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const importExcel = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      let importedCount = 0; const updatedLedgers = [...ledgers];
      json.forEach(row => {
        const cleanRow = {}; for (let key in row) cleanRow[key.trim()] = row[key];
        const amountNum = Number(cleanRow['금액'] ? String(cleanRow['금액']).replace(/[^0-9-]/g, '') : '0');
        let dateStr = '';
        if (cleanRow['날짜'] instanceof Date) {
          const d = cleanRow['날짜'];
          dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else dateStr = cleanRow['날짜'] || '';
        if (dateStr && cleanRow['아이템'] && amountNum !== 0) {
          updatedLedgers.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            date: dateStr, item: cleanRow['아이템'], amount: amountNum,
            debit: cleanRow['왼쪽'] || cleanRow['차변'] || '', credit: cleanRow['오른쪽'] || cleanRow['대변'] || '', memo: cleanRow['비고'] || cleanRow['메모'] || ''
          });
          importedCount++;
        }
      });
      if (importedCount > 0) { setLedgers(updatedLedgers); saveToDB(updatedLedgers); alert(`${importedCount}개 거래 장부 기록 완료!`); }
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // 실시간 잔액 정산 로직
  const accountBalances = {};
  allAccounts.forEach(acc => { accountBalances[acc] = 0; });
  ledgers.forEach(t => {
    const debitCategory = getAccountCategory(t.debit);
    const creditCategory = getAccountCategory(t.credit);
    if (t.debit in accountBalances) {
      if (debitCategory === 'asset' || debitCategory === 'expense') accountBalances[t.debit] += t.amount;
      else accountBalances[t.debit] -= t.amount;
    }
    if (t.credit in accountBalances) {
      if (creditCategory === 'liability' || creditCategory === 'equity' || creditCategory === 'revenue') accountBalances[t.credit] += t.amount;
      else accountBalances[t.credit] -= t.amount;
    }
  });

  // 대시보드 스코프 데이터 계산
  let totalRevenue = 0, totalExpense = 0, totalAsset = accountBalances['주계좌(카뱅)'] || 0, totalLiability = accountBalances['신용카드'] || 0;
  const expBreakdown = {}; const revBreakdown = {};
  ledgers.forEach(t => {
    if (t.date >= filterStartDate && t.date <= filterEndDate) {
      const debitCategory = getAccountCategory(t.debit);
      const creditCategory = getAccountCategory(t.credit);
      if (debitCategory === 'expense') { totalExpense += t.amount; expBreakdown[t.debit] = (expBreakdown[t.debit] || 0) + t.amount; }
      if (debitCategory === 'revenue') { totalRevenue -= t.amount; revBreakdown[t.debit] = (revBreakdown[t.debit] || 0) - t.amount; }
      if (creditCategory === 'expense') { totalExpense -= t.amount; expBreakdown[t.credit] = (expBreakdown[t.credit] || 0) - t.amount; }
      if (creditCategory === 'revenue') { totalRevenue += t.amount; revBreakdown[t.credit] = (revBreakdown[t.credit] || 0) + t.amount; }
    }
  });

  const sortedExpenses = Object.entries(expBreakdown).sort((a, b) => b[1] - a[1]);
  const sortedRevenues = Object.entries(revBreakdown).sort((a, b) => b[1] - a[1]);
  const getAccountHistory = (accName) => {
    return ledgers.filter(t => t.debit === accName || t.credit === accName).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f1f3f7', fontSize: '16px', fontWeight: '600' }}>도담캐시 엔진 부팅 중...</div>;
  }

  if (!user) {
    return (
      <div id="loginContainer">
        <div className="login-box">
          <h2>📒 도담캐시</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '-5px', marginBottom: '10px' }}>학원 통합 자산관리 네트워크</p>
          <input type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="btn-primary" onClick={handleLogin}>로그인하기</button>
        </div>
      </div>
    );
  }

  return (
    <div id="appContainer">
      {/* 레프트 뱅킹 네비게이션 */}
      <nav className="sidebar">
        <div style={{ padding: '10px 16px 20px 16px', fontSize: '18px', fontWeight: '700', color: '#0d3829' }}>📒 NevCash</div>
        <div className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>📊 홈 대시보드</div>
        <div className={`sidebar-item ${view === 'transaction' ? 'active' : ''}`} onClick={() => setView('transaction')}>📒 거래 내역 입력</div>
        <div className={`sidebar-item ${view === 'income' ? 'active' : ''}`} onClick={() => setView('income')}>📈 손익 통계 보고</div>
        <div className={`sidebar-item ${view === 'balance' ? 'active' : ''}`} onClick={() => { setView('balance'); setSelectedAccountDetail(null); }}>💰 자산 부채 실사</div>
        <div className={`sidebar-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>⚙️ 계정과목 관리</div>
      </nav>

      {/* 메인 뷰포트 영역 */}
      <div className="main-content">
        <header>
          <div className="header-title">도담캐시 금융 대시보드</div>
          <div className="header-right">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" onChange={importExcel} />
            <button className="btn-outline" onClick={() => fileInputRef.current.click()}>엑셀 가져오기</button>
            <button className="btn-outline" onClick={exportToExcel}>데이터 백업</button>
            <button className="btn-outline" style={{ color: '#df4759' }} onClick={handleLogout}>로그아웃</button>
          </div>
        </header>

        {/* --- 홈 대시보드 뷰 (NevBank 인터페이스 완벽 재현) --- */}
        {view === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
            {/* 메인 어카운트 섹션 */}
            <div className="main-account-wrapper">
              <div className="account-card">
                <div>
                  <div className="card-label">Main Account</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px', color: '#0fa46f' }}>주계좌(카카오뱅크)</div>
                </div>
                <div className="card-balance-row">
                  <div className="card-balance">₩ {(accountBalances['주계좌(카뱅)'] || 0).toLocaleString()}</div>
                  <button className="btn-outline" style={{ background: '#0fa46f', color: '#fff', border: 'none' }} onClick={() => setView('transaction')}>거래 기입하기</button>
                </div>
              </div>
              <div className="account-card account-card-green">
                <div>
                  <div className="card-label">학원 손익 상태 연동형 보드</div>
                  <div style={{ fontSize: '14px', marginTop: '4px', color: 'rgba(255,255,255,0.7)' }}>선택 범위 내 당기순이익 지표</div>
                </div>
                <div className="card-balance-row">
                  <div className="card-balance" style={{ color: '#fff' }}>₩ {(totalRevenue - totalExpense).toLocaleString()}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>6월 한 달간 순수익</div>
                </div>
              </div>
            </div>

            {/* 서브 자산 그리드 */}
            <div className="sub-cards-grid">
              <div className="sub-card"><span className="sub-card-title">💵 미수금(미납 수강료)</span><span className="sub-card-amount" style={{ color: '#df4759' }}>₩ {(accountBalances['미수금'] || 0).toLocaleString()}</span></div>
              <div className="sub-card"><span className="sub-card-title">💳 신용카드 잔대금</span><span className="sub-card-amount">₩ {(accountBalances['신용카드'] || 0).toLocaleString()}</span></div>
              <div className="sub-card"><span className="sub-card-title">📈 6월 총수익 지출원인</span><span className="sub-card-amount" style={{ color: '#0fa46f' }}>₩ {totalRevenue.toLocaleString()}</span></div>
              <div className="sub-card"><span className="sub-card-title">📉 6월 총비용 집행원인</span><span className="sub-card-amount">₩ {totalExpense.toLocaleString()}</span></div>
            </div>

            {/* 하단 2분할 레이아웃 스플릿 보드 */}
            <div className="split-content-grid">
              {/* 왼쪽: 최근 실시간 원장 타임라인 */}
              <div className="panel-card">
                <div className="panel-title">Latest Transactions <span style={{ fontSize: '12px', fontWeight: '500', color: '#0fa46f', cursor: 'pointer' }} onClick={() => setView('transaction')}>더보기 →</span></div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>날짜</th><th>아이템 명세</th><th style={{ textAlign: 'right' }}>금액</th><th>정산 구분</th></tr>
                    </thead>
                    <tbody>
                      {[...ledgers].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7).map(t => (
                        <tr key={t.id}>
                          <td style={{ color: '#64748b' }}>{t.date.substring(5)}</td>
                          <td style={{ fontWeight: '600' }}>{t.item}</td>
                          <td className="col-amount" style={{ textAlign: 'right' }}>₩ {t.amount.toLocaleString()}</td>
                          <td><span className={getAccountCategory(t.debit) === 'expense' || getAccountCategory(t.credit) === 'asset' ? 'col-debit' : 'col-credit'}>{t.debit} → {t.credit}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 오른쪽: 월별 경비 지출 차트 레이아웃 */}
              <div className="panel-card" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div className="panel-title" style={{ width: '100%' }}>All Expenses 구조도</div>
                <div className="donut-chart-box">
                  <div className="donut-circle">
                    <div className="donut-hole">
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>총 고정비 비율</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#1a1d20', marginTop: '2px' }}>₩ {totalExpense.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '10px', fontSize: '12px' }}>
                  {sortedExpenses.slice(0, 4).map(([name, val]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'between', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>{name}</span>
                      <span style={{ fontWeight: '700', marginLeft: 'auto' }}>{((val / (totalExpense || 1)) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 탭 2: 거래 내역 입력 뷰 --- */}
        {view === 'transaction' && (
          <div className="content-wrapper">
            <div className="input-panel-box">
              <div className="input-row-grid">
                <div className="input-field-group"><label>발생 날짜</label><input type="date" value={transDate} onChange={e => setTransDate(e.target.value)} /></div>
                <div className="input-field-group"><label>항목 명세 (적요)</label><input type="text" placeholder="예: 초등수학 수강료" value={transItem} onChange={e => setTransItem(e.target.value)} /></div>
                <div className="input-field-group"><label>거래 금액 (₩)</label><input type="number" placeholder="숫자만 입력" value={transAmount} onChange={e => setTransAmount(e.target.value)} /></div>
                <div className="input-field-group"><label className="col-debit">차변 (왼쪽 주머니)</label><input type="text" placeholder="자산증가/비용" value={transDebit} onChange={e => setTransDebit(e.target.value)} list="accountList" /></div>
                <div className="input-field-group"><label className="col-credit">대변 (오른쪽 주머니)</label><input type="text" placeholder="자산감소/수익" value={transCredit} onChange={e => setTransCredit(e.target.value)} list="accountList" /></div>
                <div className="input-field-group"><label>비고 메모</label><input type="text" placeholder="추가 기록 사유" value={transMemo} onChange={e => setTransMemo(e.target.value)} /></div>
                <button className="btn-action-submit" style={{ background: currentEditId ? '#ffc107' : '#0fa46f' }} onClick={addTransaction}>{currentEditId ? '수정 확정' : '장부 기입'}</button>
              </div>
              <datalist id="accountList">
                {allAccounts.map((acc, index) => <option key={index} value={acc} />)}
              </datalist>
            </div>
            <div className="panel-card" style={{ flex: 1, overflow: 'hidden' }}>
              <div className="panel-title">통합 원장 연동 타임라인 데이터</div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>발생일</th><th>거래 적요</th><th>금액</th><th className="col-debit">왼쪽 주머니</th><th className="col-credit">오른쪽 주머니</th><th>비고</th><th>관리</th></tr>
                  </thead>
                  <tbody>
                    {[...ledgers].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td style={{ fontWeight: '500' }}>{t.item}</td>
                        <td className="col-amount">₩ {t.amount.toLocaleString()}</td>
                        <td><span className="col-debit">+ {t.debit}</span></td>
                        <td><span className="col-credit">- {t.credit}</span></td>
                        <td style={{ color: '#64748b', fontSize: '13px' }}>{t.memo}</td>
                        <td>
                          <button onClick={() => editTransaction(t.id)} style={{ color: '#0fa46f', background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }}>✎</button>
                          <button onClick={() => deleteTransaction(t.id)} style={{ color: '#df4759', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- 탭 3: 손익 통계 보고 뷰 --- */}
        {view === 'income' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
            <div className="global-filter-bar">
              <div style={{ display: 'flex', gap: '8px' }}>
                <select className="filter-select" value={quickYear} onChange={e => { setQuickYear(e.target.value); applyQuickDate('year', e.target.value, quickQuarter, quickMonth); }}>
                  <option value="2025">2025년</option><option value="2026">2026년</option><option value="2027">2027년</option>
                </select>
                <select className="filter-select" value={quickMonth} onChange={e => { setQuickMonth(e.target.value); applyQuickDate('month', quickYear, quickQuarter, e.target.value); }}>
                  {[...Array(12)].map((_, i) => (<option key={i+1} value={i+1}>{i+1}월</option>))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="date" className="filter-input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                <span>~</span>
                <input type="date" className="filter-input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
              </div>
            </div>
            <div className="split-content-grid">
              <div className="panel-card">
                <div className="panel-title" style={{ color: '#df4759' }}>총 손실 비용 원인 집계 (₩ {totalExpense.toLocaleString()})</div>
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      {sortedExpenses.map(([name, val]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td className="col-amount" style={{ textAlign: 'right' }}>₩ {val.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel-card">
                <div className="panel-title" style={{ color: '#0fa46f' }}>총 매출 수익 원인 집계 (₩ {totalRevenue.toLocaleString()})</div>
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      {sortedRevenues.map(([name, val]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td className="col-amount" style={{ textAlign: 'right' }}>₩ {val.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 탭 4: 자산 부채 실사 뷰 --- */}
        {view === 'balance' && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: selectedAccountDetail ? 1 : 2, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              {['asset', 'liability', 'equity'].map(category => (
                <div key={category} className="panel-card" style={{ overflow: 'visible' }}>
                  <div className="panel-title">
                    {category === 'asset' ? '🟢 자산 실시간 포지션' : category === 'liability' ? '🔴 부채 실시간 포지션' : '🔵 기초 자본 주머니'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {customAccounts[category].map(accName => {
                      const bal = accountBalances[accName] || 0;
                      return (
                        <div key={accName} onClick={() => setSelectedAccountDetail(accName)} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e1e4ea', borderRadius: '14px', cursor: 'pointer' }}>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{accName}</div>
                          <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '6px' }}>₩ {bal.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedAccountDetail && (
              <div className="panel-card" style={{ flex: 1.2 }}>
                <div className="panel-title">
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>계정 추적 원장</div>
                    <div>🔍 {selectedAccountDetail}</div>
                  </div>
                  <button onClick={() => setSelectedAccountDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>
                <div style={{ background: '#f1f3f7', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>보유 잔고</span><span>₩ {(accountBalances[selectedAccountDetail] || 0).toLocaleString()}</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      {getAccountHistory(selectedAccountDetail).map(t => (
                        <tr key={t.id} onClick={() => editTransaction(t.id)} style={{ cursor: 'pointer' }}>
                          <td>{t.date.substring(5)}</td>
                          <td>{t.item}</td>
                          <td className="col-amount" style={{ textAlign: 'right' }}>₩ {t.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- 탭 5: 계정과목 관리 뷰 --- */}
        {view === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
            <div className="sub-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {['asset', 'liability', 'equity', 'revenue', 'expense'].map(category => (
                <div className="panel-card" key={category} style={{ minHeight: '260px' }}>
                  <div className="panel-title">
                    <span>{category.toUpperCase()} 주머니</span>
                    <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => addAccount(category)}>+ 추가</button>
                  </div>
                  <div className="table-wrapper">
                    <table style={{ fontSize: '13px' }}>
                      <tbody>
                        {customAccounts[category].map(name => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td style={{ textAlign: 'right' }}><button style={{ background: 'none', border: 'none', color: '#df4759', cursor: 'pointer' }} onClick={() => deleteAccount(category, name)}>✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function Home() {
  // --- 상태 관리 (State) ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [view, setView] = useState('transaction'); // transaction, dashboard, income, settings
  const [ledgers, setLedgers] = useState([]);
  const [currentEditId, setCurrentEditId] = useState(null);

  // 계정과목 기본 데이터
  const [customAccounts, setCustomAccounts] = useState({
    asset: ['주계좌(카뱅)', '미수금', '보증금'],
    liability: ['대출금', '신용카드'],
    equity: ['기초잔액', '자본금', '인출금'],
    revenue: ['수학수강료매출', '영어수강료매출', '교재비수익'],
    expense: ['강사료(3.3%)', '교재구입비', '임대료', '지급수수료(카드)', '광고홍보비', '소모품비', '로열티비용', '임차료']
  });

  // 기간 필터 상태 (2026년 6월 기본 세팅)
  const [filterStartDate, setFilterStartDate] = useState('2026-06-01');
  const [filterEndDate, setFilterEndDate] = useState('2026-06-30');
  const [quickYear, setQuickYear] = useState('2026');
  const [quickQuarter, setQuickQuarter] = useState('');
  const [quickMonth, setQuickMonth] = useState('6');

  // 입력 폼 상태
  const [transDate, setTransDate] = useState('');
  const [transItem, setTransItem] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transDebit, setTransDebit] = useState('');
  const [transCredit, setTransCredit] = useState('');
  const [transMemo, setTransMemo] = useState('');

  const fileInputRef = useRef(null);

  // --- 로그인 상태 감지 ---
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

  // --- 파이어베이스 데이터 불러오기 ---
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
      console.error("데이터 로드 실패:", e);
    }
    setLoading(false);
  };

  // --- 파이어베이스 데이터 저장 ---
  const saveToDB = async (newLedgers, newAccounts = customAccounts) => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(docRef, {
        ledgers: newLedgers,
        customAccounts: newAccounts
      });
    } catch (e) {
      console.error("저장 실패:", e);
    }
  };

  // --- 로그인 / 로그아웃 핸들러 ---
  const handleLogin = () => {
    if (!email || !password) return alert("이메일과 비밀번호를 입력해주세요.");
    signInWithEmailAndPassword(auth, email, password)
      .catch(err => alert("로그인 실패: " + err.message));
  };

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      signOut(auth);
    }
  };

  // --- 거래 입력 및 수정 ---
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
        id: Date.now().toString(),
        date: transDate,
        item: transItem,
        amount: Number(transAmount),
        debit: transDebit,
        credit: transCredit,
        memo: transMemo
      });
    }

    setLedgers(updatedLedgers);
    saveToDB(updatedLedgers);

    setTransItem('');
    setTransAmount('');
    setTransDebit('');
    setTransCredit('');
    setTransMemo('');
  };

  const editTransaction = (id) => {
    const target = ledgers.find(t => t.id === id);
    if (!target) return;
    setTransDate(target.date);
    setTransItem(target.item);
    setTransAmount(target.amount);
    setTransDebit(target.debit);
    setTransCredit(target.credit);
    setTransMemo(target.memo || '');
    setCurrentEditId(id);
  };

  const deleteTransaction = (id) => {
    if (confirm("이 거래 내역을 삭제하시겠습니까?")) {
      const updated = ledgers.filter(t => t.id !== id);
      setLedgers(updated);
      saveToDB(updated);
    }
  };

  // --- 계정과목 카테고리 판별 ---
  const getAccountCategory = (accountName) => {
    if (!accountName) return 'unknown';
    if (customAccounts.asset.some(acc => accountName.includes(acc))) return 'asset';
    if (customAccounts.liability.some(acc => accountName.includes(acc))) return 'liability';
    if (customAccounts.equity.some(acc => accountName.includes(acc))) return 'equity';
    if (customAccounts.revenue.some(acc => accountName.includes(acc))) return 'revenue';
    if (customAccounts.expense.some(acc => accountName.includes(acc))) return 'expense';
    return 'unknown';
  };

  // --- 계정과목 추가 / 삭제 ---
  const addAccount = (category) => {
    const newAcc = prompt("새로운 계정과목 이름을 입력하세요:");
    if (newAcc && newAcc.trim() !== '') {
      if (customAccounts[category].includes(newAcc.trim())) {
        return alert("이미 존재하는 계정과목입니다.");
      }
      const updatedAccounts = {
        ...customAccounts,
        [category]: [...customAccounts[category], newAcc.trim()]
      };
      setCustomAccounts(updatedAccounts);
      saveToDB(ledgers, updatedAccounts);
    }
  };

  const deleteAccount = (category, accName) => {
    if (confirm(`'${accName}' 계정과목을 삭제하시겠습니까? (기존 기록은 유지됩니다)`)) {
      const updatedAccounts = {
        ...customAccounts,
        [category]: customAccounts[category].filter(name => name !== accName)
      };
      setCustomAccounts(updatedAccounts);
      saveToDB(ledgers, updatedAccounts);
    }
  };

  const allAccounts = [
    ...customAccounts.asset, ...customAccounts.liability,
    ...customAccounts.equity, ...customAccounts.revenue, ...customAccounts.expense
  ];

  // --- 기간 필터 간편 선택 로직 ---
  const applyQuickDate = (type, yearVal, qtrVal, monthVal) => {
    let start = '';
    let end = '';

    if (type === 'year') {
      setQuickQuarter('');
      setQuickMonth('');
      start = `${yearVal}-01-01`;
      end = `${yearVal}-12-31`;
    } else if (type === 'quarter' && qtrVal) {
      setQuickMonth('');
      const startMonth = (qtrVal - 1) * 3 + 1;
      const endMonth = qtrVal * 3;
      start = `${yearVal}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(yearVal, endMonth, 0).getDate();
      end = `${yearVal}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
    } else if (type === 'month' && monthVal) {
      setQuickQuarter('');
      start = `${yearVal}-${String(monthVal).padStart(2, '0')}-01`;
      const lastDay = new Date(yearVal, monthVal, 0).getDate();
      end = `${yearVal}-${String(monthVal).padStart(2, '0')}-${lastDay}`;
    }

    if (start && end) {
      setFilterStartDate(start);
      setFilterEndDate(end);
    }
  };

  // --- 엑셀 내보내기 (CSV) ---
  const exportToExcel = () => {
    if (ledgers.length === 0) return alert("내보낼 데이터가 없습니다.");
    let csv = '날짜,아이템,금액,왼쪽,오른쪽,비고\n';
    ledgers.forEach(t => {
      const row = [t.date, `"${t.item}"`, t.amount, `"${t.debit}"`, `"${t.credit}"`, `"${t.memo || ''}"`].join(',');
      csv += row + '\n';
    });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "도담캐시_백업.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 엑셀 가져오기 ---
  const importExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);

      let importedCount = 0;
      const updatedLedgers = [...ledgers];

      json.forEach(row => {
        const cleanRow = {};
        for (let key in row) {
          cleanRow[key.trim()] = row[key];
        }

        let rawAmount = cleanRow['금액'] ? String(cleanRow['금액']).replace(/[^0-9-]/g, '') : '0';
        const amountNum = Number(rawAmount);

        let dateStr = '';
        if (cleanRow['날짜'] instanceof Date) {
          const d = cleanRow['날짜'];
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          dateStr = `${yyyy}-${mm}-${dd}`;
        } else {
          dateStr = cleanRow['날짜'] || '';
        }

        if (dateStr && cleanRow['아이템'] && amountNum !== 0) {
          updatedLedgers.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            date: dateStr,
            item: cleanRow['아이템'],
            amount: amountNum,
            debit: cleanRow['왼쪽'] || cleanRow['차변'] || '',
            credit: cleanRow['오른쪽'] || cleanRow['대변'] || '',
            memo: cleanRow['비고'] || cleanRow['메모'] || ''
          });
          importedCount++;
        }
      });

      if (importedCount > 0) {
        setLedgers(updatedLedgers);
        saveToDB(updatedLedgers);
        alert(`${importedCount}개의 거래 내역이 성공적으로 기록되었습니다!`);
      } else {
        alert("불러올 데이터가 없습니다. 엑셀 제목란을 확인해주세요.");
      }
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // --- 대시보드 & 손익 계산 로직 ---
  let totalRevenue = 0, totalExpense = 0, totalAsset = 0, totalLiability = 0;
  const expBreakdown = {};
  const revBreakdown = {};

  ledgers.forEach(t => {
    if (t.date >= filterStartDate && t.date <= filterEndDate) {
      const debitCategory = getAccountCategory(t.debit);
      const creditCategory = getAccountCategory(t.credit);

      if (debitCategory === 'asset') totalAsset += t.amount;
      if (debitCategory === 'expense') {
        totalExpense += t.amount;
        expBreakdown[t.debit] = (expBreakdown[t.debit] || 0) + t.amount;
      }
      if (debitCategory === 'liability') totalLiability -= t.amount;
      if (debitCategory === 'revenue') {
        totalRevenue -= t.amount;
        revBreakdown[t.debit] = (revBreakdown[t.debit] || 0) - t.amount;
      }

      if (creditCategory === 'asset') totalAsset -= t.amount;
      if (creditCategory === 'expense') {
        totalExpense -= t.amount;
        expBreakdown[t.credit] = (expBreakdown[t.credit] || 0) - t.amount;
      }
      if (creditCategory === 'liability') totalLiability += t.amount;
      if (creditCategory === 'revenue') {
        totalRevenue += t.amount;
        revBreakdown[t.credit] = (revBreakdown[t.credit] || 0) + t.amount;
      }
    }
  });

  const sortedExpenses = Object.entries(expBreakdown).sort((a, b) => b[1] - a[1]);
  const sortedRevenues = Object.entries(revBreakdown).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f7fa', fontSize: '16px', fontWeight: '600' }}>도담캐시 불러오는 중...</div>;
  }

  if (!user) {
    return (
      <div id="loginContainer">
        <div className="login-box">
          <h2>도담캐시</h2>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '-5px', marginBottom: '10px' }}>도담플래너 계정으로 로그인하세요</p>
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="btn-primary" onClick={handleLogin}>로그인</button>
        </div>
      </div>
    );
  }

  return (
    <div id="appContainer" style={{ display: 'flex' }}>
      <nav className="sidebar">
        <div className={`sidebar-item ${view === 'transaction' ? 'active' : ''}`} onClick={() => setView('transaction')}>📒 거래입력</div>
        <div className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>📊 대시보드</div>
        <div className={`sidebar-item ${view === 'income' ? 'active' : ''}`} onClick={() => setView('income')}>📈 비용/수익</div>
        <div className="sidebar-item" onClick={() => alert('준비 중입니다!')}>💰 자산/부채</div>
        <div className={`sidebar-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>⚙️ 환경설정</div>
      </nav>

      <div className="main-content">
        <header>
          <div className="header-title">
            📒 도담캐시 <span style={{ fontSize: '14px', fontWeight: '500', color: '#888', marginLeft: '10px' }}>학원 통합 장부</span>
          </div>
          <div className="header-right">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" onChange={importExcel} />
            <button className="btn-outline" onClick={() => fileInputRef.current.click()}>가져오기</button>
            <button className="btn-outline" onClick={exportToExcel}>내보내기</button>
            <button className="btn-outline" onClick={() => handleLogout()}>로그아웃</button>
          </div>
        </header>

        {(view === 'dashboard' || view === 'income') && (
          <div className="global-filter-bar" style={{ display: 'flex' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select className="filter-select" value={quickYear} onChange={e => { setQuickYear(e.target.value); applyQuickDate('year', e.target.value, quickQuarter, quickMonth); }}>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
                <option value="2027">2027년</option>
              </select>
              <select className="filter-select" value={quickQuarter} onChange={e => { setQuickQuarter(e.target.value); applyQuickDate('quarter', quickYear, e.target.value, quickMonth); }}>
                <option value="">분기 선택</option>
                <option value="1">1분기 (1~3월)</option>
                <option value="2">2분기 (4~6월)</option>
                <option value="3">3분기 (7~9월)</option>
                <option value="4">4분기 (10~12월)</option>
              </select>
              <select className="filter-select" value={quickMonth} onChange={e => { setQuickMonth(e.target.value); applyQuickDate('month', quickYear, quickQuarter, e.target.value); }}>
                <option value="">월 선택</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}월</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>직접입력</span>
              <input type="date" className="filter-input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
              <span style={{ color: '#94a3b8' }}>~</span>
              <input type="date" className="filter-input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
            </div>
          </div>
        )}

        {view === 'transaction' && (
          <div className="content-wrapper">
            <div className="input-panel">
              <div className="input-row">
                <div className="input-group" style={{ flex: 0.8 }}><label>날짜</label><input type="date" value={transDate} onChange={e => setTransDate(e.target.value)} /></div>
                <div className="input-group" style={{ flex: 1.2 }}><label>아이템</label><input type="text" placeholder="예: 초등수학" value={transItem} onChange={e => setTransItem(e.target.value)} /></div>
                <div className="input-group" style={{ flex: 1 }}><label>금액</label><input type="number" placeholder="숫자만" value={transAmount} onChange={e => setTransAmount(e.target.value)} /></div>
                <div className="input-group" style={{ flex: 1 }}><label className="col-debit">차변(왼쪽)</label><input type="text" placeholder="자산증가/비용" value={transDebit} onChange={e => setTransDebit(e.target.value)} list="accountList" /></div>
                <div className="input-group" style={{ flex: 1 }}><label className="col-credit">대변(오른쪽)</label><input type="text" placeholder="자산감소/수익" value={transCredit} onChange={e => setTransCredit(e.target.value)} list="accountList" /></div>
                <div className="input-group" style={{ flex: 1.5 }}><label>비고(메모)</label><input type="text" placeholder="내용 등" value={transMemo} onChange={e => setTransMemo(e.target.value)} /></div>
                <button className="btn-submit" style={{ backgroundColor: currentEditId ? '#FF9955' : '#545ceb' }} onClick={addTransaction}>{currentEditId ? '수정 완료' : '입력'}</button>
              </div>
              <datalist id="accountList">
                {allAccounts.map((acc, index) => <option key={index} value={acc} />)}
              </datalist>
            </div>
            <div className="list-panel">
              <div className="list-header">최근 입력된 거래들</div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>날짜</th><th>아이템</th><th>금액</th><th className="col-debit">왼쪽 (차변)</th><th className="col-credit">오른쪽 (대변)</th><th>비고</th><th></th></tr>
                  </thead>
                  <tbody>
                    {[...ledgers].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td>{t.item}</td>
                        <td className="col-amount">₩ {t.amount.toLocaleString()}</td>
                        <td><span className="col-debit">+ {t.debit}</span></td>
                        <td><span className="col-credit">- {t.credit}</span></td>
                        <td style={{ color: '#64748b', fontSize: '13px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.memo}>{t.memo}</td>
                        <td style={{ textAlign: 'right', minWidth: '70px' }}>
                          <button className="btn-delete" onClick={() => editTransaction(t.id)} style={{ color: '#3b82f6', marginRight: '10px' }}>✎</button>
                          <button className="btn-delete" onClick={() => deleteTransaction(t.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>학원 재무 현황</h3>
            <div className="dashboard-grid">
              <div className="summary-card">
                <div className="card-title">선택 기간 수익</div>
                <div className="card-amount col-credit">₩ {totalRevenue.toLocaleString()}</div>
              </div>
              <div className="summary-card">
                <div className="card-title">선택 기간 비용</div>
                <div className="card-amount col-debit">₩ {totalExpense.toLocaleString()}</div>
              </div>
              <div className="summary-card">
                <div className="card-title">현재 자산 (통장 등)</div>
                <div className="card-amount">₩ {totalAsset.toLocaleString()}</div>
              </div>
              <div className="summary-card">
                <div className="card-title">현재 부채 (대출 등)</div>
                <div className="card-amount">₩ {totalLiability.toLocaleString()}</div>
              </div>
            </div>
            <div className="summary-card" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
              <div className="card-title">당기순이익 (수익 - 비용)</div>
              <div className="card-amount" style={{ color: '#545ceb' }}>₩ {(totalRevenue - totalExpense).toLocaleString()}</div>
            </div>
          </div>
        )}

        {view === 'income' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>비용 / 수익 상세내역</h3>
            <div className="income-grid">
              <div className="income-card">
                <div className="income-header">
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>총 비용</span>
                  <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '18px' }}>₩ {totalExpense.toLocaleString()}</span>
                </div>
                <ul className="income-list">
                  {sortedExpenses.map(([accName, amount]) => amount !== 0 && (
                    <li className="income-item" key={accName}>
                      <span className="income-item-name">{accName}</span>
                      <span className="income-item-amount">{amount.toLocaleString()}</span>
                      <span className="income-item-percent">{totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : 0}%</span>
                    </li>
                  ))}
                  {sortedExpenses.length === 0 && <li className="income-item" style={{ color: '#94a3b8', justifyContent: 'center' }}>조회된 내역이 없습니다.</li>}
                </ul>
              </div>

              <div className="income-card">
                <div className="income-header">
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>총 수익</span>
                  <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: '18px' }}>₩ {totalRevenue.toLocaleString()}</span>
                </div>
                <ul className="income-list">
                  {sortedRevenues.map(([accName, amount]) => amount !== 0 && (
                    <li className="income-item" key={accName}>
                      <span className="income-item-name">{accName}</span>
                      <span className="income-item-amount">{amount.toLocaleString()}</span>
                      <span className="income-item-percent">{totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(1) : 0}%</span>
                    </li>
                  ))}
                  {sortedRevenues.length === 0 && <li className="income-item" style={{ color: '#94a3b8', justifyContent: 'center' }}>조회된 내역이 없습니다.</li>}
                </ul>
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px dashed #e2e8f0' }}>
                  <div className="income-header" style={{ border: 'none', padding: 0 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>당기순이익</span>
                    <span style={{ fontWeight: 700, color: '#545ceb', fontSize: '20px' }}>₩ {(totalRevenue - totalExpense).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>계정과목 설정</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '-10px' }}>등록한 계정과목은 거래 입력 시 자동완성되며, 대시보드 통계에 반영됩니다.</p>
            <div className="settings-grid">
              {['asset', 'liability', 'equity', 'revenue', 'expense'].map(category => (
                <div className="settings-card" key={category}>
                  <div className="settings-header">
                    <span className="settings-title">{category === 'asset' ? '자산 (Asset)' : category === 'liability' ? '부채 (Liability)' : category === 'equity' ? '순자산 (Equity)' : category === 'revenue' ? '수익 (Revenue)' : '비용 (Expense)'}</span>
                    <button className="btn-add-acc" onClick={() => addAccount(category)}>+ 추가</button>
                  </div>
                  <ul className="acc-list">
                    {customAccounts[category].map(accName => (
                      <li className="acc-item" key={accName}>
                        <span>{accName}</span>
                        <button className="btn-del-acc" onClick={() => deleteAccount(category, accName)}>✕</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
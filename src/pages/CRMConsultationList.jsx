export default function CRMConsultationList() {
  const statusTabs = [
    { label: '전체', count: 21, active: true },
    { label: '예약', count: 6 },
    { label: '문의', count: 4 },
    { label: '수업중', count: 8 },
  ];

  const cards = [
    {
      name: '김지우',
      phone: '01043023103',
      age: '12세',
      gender: '남',
      relation: '어머니',
      memo: 'ADHD 초등5 너무 느리고 띄어쓰기 되지 않음',
      created: '2026-04-20',
      alarm: '2026-04-20 오전 9:32',
      classInfo: '수업중 · 2026-05-03 일요일 오전 10:30',
    },
    {
      name: '최주경',
      phone: '01092580591',
      age: '53세',
      gender: '여',
      relation: '일반어',
      memo: '중지 당김 손이 너무 아픔',
      created: '2026-04-19',
      alarm: '2026-04-19 오후 1:30',
      classInfo: '수업중 · 2026-04-27 월요일 오후 1:30',
    },
    {
      name: '김지안',
      phone: '01012341234',
      age: '10세',
      gender: '여',
      relation: '어머니',
      memo: '받침 교정 필요',
      created: '2026-04-18',
      alarm: '2026-04-18 오전 11:20',
      classInfo: '수업중 · 2026-04-30 화요일 오후 2:00',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f1f2f5] flex justify-center">
      <div className="w-full max-w-[390px] bg-[#f1f2f5] pb-24 relative overflow-hidden">
        <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#2f6df6] text-white flex items-center justify-center font-black text-2xl">
                C
              </div>

              <div>
                <h1 className="text-[17px] font-black leading-tight text-[#111827]">
                  상담 CRM
                </h1>
                <p className="text-[13px] text-gray-500 font-semibold">본사 관리자</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="px-4 py-2.5 rounded-2xl border border-gray-200 bg-[#f7f7f7] text-gray-700 font-bold text-sm">
                로그아웃
              </button>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className="text-lg">🔍</span>
            <input
              placeholder="이름 또는 전화번호 검색"
              className="bg-transparent outline-none flex-1 text-[14px] placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 bg-[#f1f2f5] sticky top-[124px] z-10">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {statusTabs.map((tab) => (
              <button
                key={tab.label}
                className={`px-4 py-2 rounded-full whitespace-nowrap border text-[14px] font-bold ${
                  tab.active
                    ? 'bg-[#edf4ff] border-[#bdd4ff] text-[#2f6df6]'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                {tab.label} {tab.count}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pt-4 space-y-4">
          {cards.map((card) => (
            <div
              key={card.name}
              className="bg-white rounded-[22px] p-4 shadow-sm border border-[#ebebeb]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-black text-black">
                    {card.name}
                  </h2>

                  <div className="mt-1 text-[15px] font-semibold text-gray-700">
                    {card.phone} · {card.age}
                  </div>

                  <div className="text-[15px] text-gray-600 font-medium">
                    {card.gender} · {card.relation}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded-xl bg-[#f4f4f4] text-gray-700 font-bold text-[13px]">
                    수정
                  </button>
                  <button className="px-3 py-2 rounded-xl bg-[#fff5f5] border border-red-100 text-red-400 font-bold text-[13px]">
                    삭제
                  </button>
                </div>
              </div>

              <p className="mt-4 text-[15px] leading-relaxed font-black text-gray-900 break-keep">
                {card.memo}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px] text-gray-600 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>📅</span>
                  <span>{card.created}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>🔔</span>
                  <span>{card.alarm}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1.5 rounded-full bg-[#edf4ff] text-[#2f6df6] text-[12px] font-black">
                  등록
                </span>

                <div className="px-3 py-1.5 rounded-full bg-[#f3f4f6] text-gray-700 text-[12px] font-semibold">
                  {card.classInfo}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#cfcfcf] text-white text-2xl shadow-xl flex items-center justify-center">
          ✎
        </button>

        <div className="fixed bottom-0 left-0 right-0 flex justify-center z-30">
          <div className="w-full max-w-[390px] bg-white border-t border-gray-200 px-2 py-2">
            <div className="grid grid-cols-5 gap-1 text-center">
              {[
                ['☰', '상담목록', true],
                ['＋', '상담등록'],
                ['◔', '예약일'],
                ['✉', '문자대상'],
                ['✔', '출석관리'],
              ].map(([icon, label, active]) => (
                <button
                  key={label}
                  className={`flex flex-col items-center justify-center gap-1 py-2 rounded-2xl ${
                    active ? 'text-[#2f6df6]' : 'text-gray-400'
                  }`}
                >
                  <span className="text-[24px] leading-none">{icon}</span>
                  <span className="text-[12px] font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


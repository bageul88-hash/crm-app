export async function addConsult(data) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action: 'add', ...data }),
  })

  if (!res.ok) throw new Error('저장에 실패했습니다')
  return res.json()
}

export async function updateConsult(data) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action: 'update', ...data }),
  })

  if (!res.ok) throw new Error('수정에 실패했습니다')
  return res.json()
}

export async function deleteConsult(id) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action: 'delete', id }),
  })

  if (!res.ok) throw new Error('삭제에 실패했습니다')
  return res.json()
}
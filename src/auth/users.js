export const BRANCHES = Array.from({ length: 18 }, (_, i) => {
  const no = String(i + 1).padStart(2, '0')

  return {
    id: `pentwo_${no}`,
    name: `${i + 1}호점`,
  }
})

export const USERS = [
  {
    id: 'admin',
    password: 'admin1234',
    name: '본사 관리자',
    role: 'admin',
    branchId: null,
    branchName: '본사',
  },

  ...BRANCHES.map((branch) => ({
    id: branch.id,
    password: '1234',
    name: `${branch.name} 원장`,
    role: 'branch',
    branchId: branch.id,
    branchName: branch.name,
  })),
]
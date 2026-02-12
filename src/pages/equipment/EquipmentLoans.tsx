import React from 'react'
import { useEquipmentLoans } from '../../hooks/useEquipment'

export default function EquipmentLoans() {
  const { loans, loading, error } = useEquipmentLoans()

  if (loading) return <p>Carregando empréstimos...</p>
  if (error) return <p>Erro: {error}</p>

  return (
    <div>
      <h1>Empréstimos de Equipamentos</h1>
      <ul>
        {loans.map((loan) => (
          <li key={loan.id}>
            {loan.equipment_id} - {loan.borrower_name} ({loan.status})
          </li>
        ))}
      </ul>
    </div>
  )
}

import { BackButton } from '../../components/ui.jsx'
import BankDetailsForm from './BankDetailsForm.jsx'
import Fees from './Fees.jsx'
import MonthlyMinimumForm from './MonthlyMinimumForm.jsx'

/**
 * Settings the admin changes now and then, kept off the Sales screen so the
 * orders come first there.
 */
export default function Settings() {
  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/admin?tab=sales" />
        <h2 className="title-sm">Settings</h2>
      </div>
      <div className="scroll px-22 pt-8 pb-24 stack gap-16">
        <Fees />
        <MonthlyMinimumForm />
        <BankDetailsForm />
      </div>
    </div>
  )
}

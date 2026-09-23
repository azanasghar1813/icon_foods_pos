import React from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { usePrinterStore } from '../store/printerStore'
import type { PrintJob } from '../store/printerStore'
import { useKdsStore } from '../store/kdsStore'
import { useOrderStore } from '../store/orderStore'
import { QRCodeSVG } from 'qrcode.react'
import { formatReceiptOrderNumber } from '../utils/receiptOrderNumber'

export const PrintTemplates: React.FC = () => {
  const { printQueue } = usePrinterStore()
  const printingJobs = printQueue.filter(j => j.status === 'PROCESSING' || j.status === 'PENDING')

  return (
    <div className="hidden print:block absolute inset-0 bg-white z-[9999] w-full">
      {printingJobs.map(job => (
        <PrintJobRenderer key={job.id} job={job} />
      ))}
    </div>
  )
}

const PrintJobRenderer: React.FC<{ job: PrintJob }> = ({ job }) => {
  if (job.job_type === 'Receipt') return <ReceiptTemplate job={job} />
  if ((job as any).type === 'KitchenTicket') return <KitchenTicketTemplate job={job} />
  return null
}

const ReceiptTemplate: React.FC<{ job: PrintJob }> = ({ job }) => {
  const settings = useSettingsStore(s => (s as any).settings)
  const printSettings = usePrinterStore(s => s.settings)
  
  let orderId = ''
  try {
    orderId = JSON.parse((job as any).content).orderId
  } catch (e) {
    return null
  }

  const order = useOrderStore(s => s.orders.find(o => o.id === orderId))
  if (!order) return null

  const isDelivery = order.orderType === 'Delivery'
  const isDineIn = order.orderType === 'Dine In' || String(order.orderType || '').toLowerCase().includes('dine')

  return (
    <div className={`p-4 mx-auto text-black font-sans bg-white`} style={{ width: printSettings.receiptWidth }}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="w-24 h-24 bg-[#222] rounded-full flex flex-col items-center justify-center mb-2 text-white border-2 border-black">
           <div className="text-lg font-black tracking-widest leading-none mt-2">ICON FOOD</div>
           <div className="text-lg font-black tracking-widest leading-none mb-1">PIZZA HUT</div>
           <div className="text-[9px] font-bold tracking-[0.2em] border-t border-white/50 pt-1 mt-1">& CAFE</div>
        </div>
        <div className="text-xl font-black text-center mt-2">{settings.businessName}</div>
        <div className="text-xs text-center mt-1 font-semibold leading-tight">
          Jhang road sabzi mandi, Near shell pump Chaniot<br/>
          Contact: 03299792223, 03159792247
        </div>
      </div>

      <div className="text-sm font-bold mb-4 space-y-0.5">
        <div className="text-[15px] font-black leading-tight">{formatReceiptOrderNumber(order.orderNumber)}</div>
        
        {isDelivery && order.customerName && (
          <div className="flex gap-1">
             <span className="shrink-0">Customer:</span>
             <span className="break-words font-semibold">{order.customerName} {order.customerPhone ? <> - <span className="font-black text-[14px]">{order.customerPhone}</span></> : ''} {order.customerAddress ? `- ${order.customerAddress}` : ''}</span>
          </div>
        )}
        
        {isDineIn && order.tableNumber && order.tableNumber !== 'N/A' && (
          <div><span className="mr-1">Table No:</span>{order.tableNumber}</div>
        )}
        
        <div><span className="mr-1">Order Type:</span>{order.orderType}</div>
        
        
        
        {isDelivery && order.riderName && (
          <div><span className="mr-1">Rider:</span>{order.riderName}</div>
        )}
        {!isDelivery && order.waiterName && (
          <div><span className="mr-1">Waiter:</span>{order.waiterName}</div>
        )}
        
        
        
        <div className="text-[13px] font-black">{new Date(order.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(',', '')}</div>
        
        {order.isVip && (
          <div className="font-black uppercase text-lg py-1 mt-3 mb-2 text-center border-2 border-black rounded-sm w-full">** VIP ORDER **</div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full text-sm font-bold border-2 border-black mb-4 border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-center py-1 px-1 border-r-2 border-black w-[60%]">Item</th>
            <th className="text-center py-1 px-1 border-r-2 border-black w-[20%]">Qty</th>
            <th className="text-center py-1 px-1 w-[20%]">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={idx} className="border-b-2 border-black last:border-b-0">
              <td className="text-center py-1 px-1 border-r-2 border-black uppercase font-black">
                {item.name}
                {item.selectedModifiers?.map((m: any) => (
                  <div key={m.name} className="text-xs font-normal">+ {m.name}</div>
                ))}
                {(item as any).combo_components?.map((c: any, cidx: number) => (
                  <div key={cidx} className="text-xs font-normal">- {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.product_name_snapshot} {c.variant_snapshot && `(${c.variant_snapshot})`}</div>
                ))}
              </td>
              <td className="text-center py-1 px-1 border-r-2 border-black font-black text-base align-middle">{item.quantity}</td>
              <td className="text-center py-1 px-1 font-black whitespace-nowrap align-middle">
                {settings.currencySymbol} {(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex flex-col items-end text-sm font-bold space-y-0.5 mb-8 w-full pr-1">
        <div className="flex justify-between w-[200px]">
          <span>Subtotal:</span>
          <span>{settings.currencySymbol} {order.subtotal.toFixed(2)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between w-[200px]">
            <span>Discount:</span>
            <span>- {settings.currencySymbol} {order.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between w-[200px]">
          <span>Tax:</span>
          <span>{settings.currencySymbol} {order.tax.toFixed(2)}</span>
        </div>
        {order.serviceCharge > 0 && (
          <div className="flex justify-between w-[200px]">
            <span>Service Charges:</span>
            <span>{settings.currencySymbol} {order.serviceCharge.toFixed(2)}</span>
          </div>
        )}
        {(order.deliveryCharge ?? 0) > 0 && (
          <div className="flex justify-between w-[200px]">
            <span>Delivery:</span>
            <span>{settings.currencySymbol} {(order.deliveryCharge ?? 0).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between w-[200px] font-black text-base underline underline-offset-4 mt-1 pt-1">
          <span>Total Amount:</span>
          <span>{settings.currencySymbol} {order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer text */}
      <div className="text-center text-sm font-semibold mb-6">
        Thank you for your order!<br/>
        Please visit again.
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-6">
        <QRCodeSVG value={`https://verify.iconfood.com/order/${order.id}`} size={120} />
      </div>
      
      {/* Cut placeholder */}
      {printSettings.cutPaper && (
        <div className="text-center text-xs text-gray-400 mt-10">--- Cut ---</div>
      )}
    </div>
  )
}

const KitchenTicketTemplate: React.FC<{ job: PrintJob }> = ({ job }) => {
  const printSettings = usePrinterStore(s => s.settings)
  
  let ticketId = ''
  try {
    ticketId = JSON.parse((job as any).content).ticketId
  } catch (e) {
    return null
  }

  const ticket = useKdsStore(s => s.tickets.find(t => t.id === ticketId))
  if (!ticket) return null

  const isEdit = ticket.notes === 'EDITED TICKET'

  return (
    <div className={`p-4 mx-auto text-black font-mono`} style={{ width: printSettings.receiptWidth }}>
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-2xl font-black mb-1 uppercase">{ticket.kitchen}</div>
        <div className="text-xl font-bold border-y-2 border-black py-1 my-2">
          {isEdit ? '*** MODIFIED TICKET ***' : 'KITCHEN TICKET'}
        </div>
      </div>

      <div className="text-sm font-bold mb-4 space-y-1">
        <div className="text-xl font-black">{formatReceiptOrderNumber(ticket.orderNumber)}</div>
        <div>Type: {ticket.orderType}</div>
        {ticket.orderType === 'Dine In' && <div>Table: {ticket.table}</div>}
        <div className="font-black">Time: {new Date(ticket.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {/* Items */}
      <div className="border-t border-b-2 border-black py-4 mb-4">
        {ticket.items.map((item, idx) => (
          <div key={idx} className="mb-4">
            <div className="flex items-start gap-2 text-lg">
              {item.type === 'ADD' && <span className="font-black border border-black px-1">+ADD</span>}
              {item.type === 'REMOVE' && <span className="font-black border border-black px-1 line-through">-REM</span>}
              
              <span className="font-black min-w-[2ch]">{item.quantity}x</span>
              <span className={`font-bold ${item.type === 'REMOVE' ? 'line-through' : ''}`}>{item.name}</span>
            </div>
            
            {item.modifiers?.length > 0 && (
              <div className="pl-8 text-sm mt-1 space-y-1">
                {item.modifiers.map((m: any) => (
                  <div key={m.name}>- {m.name}</div>
                ))}
              </div>
            )}
            
            {(item as any).combo_components && (item as any).combo_components.length > 0 && (
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', paddingLeft: '4px', borderLeft: '1px solid #ccc', marginLeft: '8px' }}>
                {(item as any).combo_components.map((c: any, cidx: number) => (
                  <div key={cidx}>- {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.product_name_snapshot} {c.variant_snapshot && `(${c.variant_snapshot})`}</div>
                ))}
              </div>
            )}
            
            {item.notes && (
              <div className="pl-8 text-sm italic font-bold mt-1">
                Note: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {printSettings.cutPaper && (
        <div className="text-center text-xs text-gray-400 mt-10">--- Cut ---</div>
      )}
    </div>
  )
}

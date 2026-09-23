import { useEffect } from "react"
import { Printer, X } from "lucide-react"
import type { Order } from "../store/orderStore"
import { itemVariantName } from "../store/orderStore"
import { useSettingsStore } from "../store/settingsStore"
import { formatReceiptOrderNumber } from "../utils/receiptOrderNumber"

interface ReceiptPreviewProps {
  order?: Order
  autoPrint?: boolean
  onClose?: () => void
  isKot?: boolean
}

export default function ReceiptPreview({ order, autoPrint, onClose, isKot }: ReceiptPreviewProps) {
  const settings = useSettingsStore()

  // â”€â”€ data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const orderNumber = formatReceiptOrderNumber(order?.orderNumber || order?.id)
  const orderType = order?.orderType ?? "Dine In"
  const tableNumber = order?.tableNumber ?? null
  const cashier = order?.cashierName ?? "Cashier"
  const customerName = order?.customerName || 'Guest'
  const customerPhone = order?.customerPhone ?? null
  const customerAddress = order?.customerAddress ?? null
  const isVip = !!(
    (order as any)?.customer?.is_vip ||
    (order as any)?.customer?.isVip ||
    (order as any)?.isVip ||
    (order as any)?.is_vip ||
    (order as any)?.metadata?.is_vip === true ||
    (order as any)?.metadata?.is_vip === 'true' ||
    String((order as any)?.metadata?.is_vip || '') === '1'
  )
  const receiptAddress = (settings.address || 'Jhang road sabzi mandi ,Near shell pump Chaniot').replace(/\n/g, '<br>')
  const receiptPhone = settings.phoneNumber || '03299792223 , 03159792247'
  const notes = order?.notes ?? null
  const paymentStatus = order?.paymentStatus ?? "Unpaid"
  const paymentMethod = (order as any)?.paymentMethod || (order as any)?.payments?.[0]?.method || null
  const timestamp = order ? new Date(order.timestamp) : new Date()
  const dateStr = timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const items = order?.items ?? [] as any[]
  const subtotal = order?.subtotal ?? 0
  const serviceCharge = 0
  const deliveryCharge = order?.deliveryCharge ?? 0
  const discount = order?.discount ?? 0
  const total = order?.total ?? 0

  const isDelivery = String(orderType).toLowerCase().includes('delivery')
  const isDineIn = String(orderType).toLowerCase().includes('dine')

  // â”€â”€ print via isolated window (exactly matching POS layout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const doPrint = () => {
    const rows = items.map((item: any) => {
      let itemTotal = item.price * item.quantity
      if (item.selectedModifiers?.length) {
        const modTotal = item.selectedModifiers.reduce((s: number, m: any) => s + (m.price || 0), 0)
        itemTotal = (item.price + modTotal) * item.quantity
      }

      const isDeal = item.category?.toLowerCase().includes('deal') || (item.name || '').toLowerCase().includes('deal')
      const itemNameClass = isDeal ? `font-weight:900;` : `font-weight:500;`

      const variantLabel = itemVariantName(item)
      const variantHtml = variantLabel
        ? `<div style="font-size:10px;font-weight:400;margin-top:2px">(${variantLabel})</div>`
        : ''
      const mods = item.selectedModifiers?.length
        ? `<div style="font-size:10px;font-weight:400;margin-top:2px">${item.selectedModifiers.map((m: any) => '+' + (m.name || m.modifier_name_snapshot || '')).join(', ')}</div>`
        : ''
      const combos = item.combo_components?.length
        ? `<div style="font-size:10px;font-weight:400;margin-top:2px">${item.combo_components.map((c: any) => `- ${c.quantity > 1 ? c.quantity + 'x ' : ''}${c.product_name_snapshot || ''}${c.variant_snapshot ? ' (' + c.variant_snapshot + ')' : ''}`).join('<br>')}</div>`
        : ''
      const itemNotes = item.notes
        ? `<div style="font-size:10px;font-weight:700;margin-top:2px">Note: ${item.notes}</div>`
        : ''
      return `
        <tr style="border-bottom:2px solid #000;">
          <td style="padding:4px;border-right:2px solid #000;text-align:center;text-transform:uppercase;">
            <div style="${itemNameClass}">${item.name}</div>${variantHtml}${mods}${combos}${itemNotes}
          </td>
          <td style="padding:4px;border-right:2px solid #000;text-align:center;font-weight:500;font-size:13px;vertical-align:middle;">${item.quantity}</td>
          <td style="padding:4px;text-align:center;font-weight:500;vertical-align:middle;white-space:nowrap;">Rs ${itemTotal.toFixed(2)}</td>
        </tr>`
    }).join('')

    const itemsHtml = `
      <table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:8px;font-size:11px;">
        <thead>
          <tr style="border-bottom:2px solid #000;">
            <th style="padding:4px;border-right:2px solid #000;width:60%;">Item</th>
            <th style="padding:4px;border-right:2px solid #000;width:20%;">Qty</th>
            <th style="padding:4px;width:20%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>`

    const dcRow = orderType === 'Delivery' && deliveryCharge > 0
      ? `<div style="display:flex;justify-content:flex-end;width:100%;margin-bottom:3px"><span style="font-weight:900;margin-right:16px;">Delivery:</span><span>Rs ${deliveryCharge.toFixed(2)}</span></div>` : ''
    const discRow = discount > 0
      ? `<div style="display:flex;justify-content:flex-end;width:100%;margin-bottom:3px"><span style="font-weight:900;margin-right:16px;">Discount:</span><span>-Rs ${discount.toFixed(2)}</span></div>` : ''

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${orderNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:sans-serif; background:#fff; color:#000; display:flex; justify-content:center; align-items:flex-start; min-height:100vh; }
    .receipt { width:80mm; max-width:302px; padding:8px; }
    @media print { 
      html, body { width:80mm; display:block; }
      .receipt { width:100%; padding:4px; margin:0; }
      @page { margin:3mm; size:80mm auto; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div style="display:flex;justify-content:center;margin-bottom:6px">
      <img src="/receipt_logo.png" style="width:140px;object-fit:contain;" onerror="this.style.display='none'" />
    </div>
    
    <!-- Address -->
    <div style="text-align:center;font-size:9.5px;font-weight:600;color:#000;line-height:1.35;margin-bottom:12px">
      <div>Jhang road sabzi mandi , Near shell pump Chaniot</div>
      <div>Contact: <b>03299792223 , 03159792247</b></div>
    </div>

    <!-- Order Details -->
    <div style="font-size:11px;display:flex;flex-direction:column;gap:3px;margin-bottom:12px">
      <div style="font-size:15px;font-weight:900;line-height:1.2;">${orderNumber}</div>
      <div style="display:flex"><span style="margin-right:4px;font-weight:900;">Customer:</span><span>${customerName}${customerPhone ? ' - <b style="font-size:14px">' + customerPhone + '</b>' : ''}${customerAddress ? ' - ' + customerAddress : ''}</span></div>
      ${isDineIn && tableNumber && tableNumber !== 'N/A' ? `<div><span style="margin-right:4px;font-weight:900;">Table No:</span>${tableNumber}</div>` : ''}
      <div><span style="margin-right:4px;font-weight:900;">Order Type:</span>${orderType}</div>

      <div style="font-size:13px;font-weight:900;">${dateStr}, ${timeStr}</div>
      ${isVip ? `<div style="text-align:center;padding:4px 0;margin-top:6px;font-weight:900;font-size:14px;border:2px solid #000;border-radius:4px;width:100%;">** VIP ORDER **</div>` : ''}
    </div>

    <!-- Items -->
    <div style="margin-bottom:12px">${itemsHtml}</div>
    ${notes ? `<div style="margin-bottom:12px;font-weight:900;border-top:2px dashed #000;padding-top:6px;font-size:11px;">NOTE: ${notes}</div>` : ''}

    <!-- Totals -->
    <div style="font-size:11px;display:flex;flex-direction:column;align-items:flex-end;padding-right:2px;margin-bottom:12px">
      <div style="display:flex;justify-content:flex-end;width:100%;margin-bottom:3px"><span style="font-weight:900;margin-right:16px;">Subtotal:</span><span>Rs ${subtotal.toFixed(2)}</span></div>
      ${dcRow}${discRow}
      <div style="display:flex;justify-content:flex-end;width:100%;font-size:13px;font-weight:900;text-decoration:underline;text-underline-offset:2px;margin-top:4px;padding-top:4px"><span style="margin-right:16px;">Total Amount:</span><span>Rs ${total.toFixed(2)}</span></div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:16px;font-size:11px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px">
      <p>Thank you for your order!<br>Please visit again.</p>
      <div style="margin-top:12px;">
        <img src="/receipt_qr.jpg" style="width:160px;height:160px;object-fit:contain" onerror="this.style.display='none'" />
      </div>
      <div style="font-size:11px;font-weight:600;margin-top:8px;">Powered by : corevex.tech (-_-)</div>
    </div>
  </div>
</body>
</html>`

    const pw = window.open('', '_blank', 'width=420,height=780')
    if (!pw) { alert('Please allow popups to print receipts.'); return }
    pw.document.write(html)
    pw.document.close()
    pw.focus()
    setTimeout(() => {
      pw.print()
      setTimeout(() => { pw.close(); if (onClose) onClose() }, 600)
    }, 400)
  }

  // Auto-print on mount
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(doPrint, 300)
      return () => clearTimeout(t)
    }
  }, [autoPrint])

  // â”€â”€ Preview UI (modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const receiptPreview = (
    <div className="bg-white text-black font-sans p-4 rounded-lg w-full max-w-sm mx-auto shadow-sm" style={{ width: '320px' }}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-6">
        <img src="/receipt_logo.png" className="w-[140px] object-contain mb-2" onError={(e: any) => e.target.style.display = 'none'} />
        <div className="text-[10px] text-center mt-1 font-semibold leading-[1.35] w-full whitespace-pre-line">
          Jhang road sabzi mandi , Near shell pump Chaniot
          {'\n'}Contact: <span className="font-black">03299792223 , 03159792247</span>
        </div>
      </div>

      {/* Order Details */}
      <div className="text-[11px] flex flex-col gap-0.5 text-black mb-4">
        <div className="text-[15px] font-black leading-tight">{orderNumber}</div>
        <div className="flex gap-1">
          <span className="shrink-0 font-black">Customer:</span>
          <span className="break-words">{customerName}{customerPhone ? <> - <span className="font-black text-[14px]">{customerPhone}</span></> : ''}{customerAddress ? ' - ' + customerAddress : ''}</span>
        </div>
        {isDineIn && tableNumber && tableNumber !== 'N/A' && (
          <div><span className="mr-1 font-black">Table No:</span>{tableNumber}</div>
        )}
        <div><span className="mr-1 font-black">Order Type:</span>{orderType}</div>

        <div className="text-[13px] font-black">{dateStr}, {timeStr}</div>
        {isVip && (
          <div className="font-black uppercase text-sm py-1 mt-2 text-center border-2 border-black rounded-sm w-full">** VIP ORDER **</div>
        )}
      </div>

      {/* Items */}
      <table className="w-full text-[11px] font-bold border-2 border-black mb-4 border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className={`text-center py-1 px-1 ${!isKot ? 'border-r-2 border-black' : ''} ${isKot ? 'w-[80%]' : 'w-[60%]'}`}>Item</th>
            <th className={`text-center py-1 px-1 ${!isKot ? 'border-r-2 border-black' : ''} w-[20%]`}>Qty</th>
            {!isKot && <th className="text-center py-1 px-1 w-[20%]">Total</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            let itemTotal = item.price * item.quantity
            if (item.selectedModifiers?.length) {
              const modTotal = item.selectedModifiers.reduce((s: number, m: any) => s + (m.price || 0), 0)
              itemTotal = (item.price + modTotal) * item.quantity
            }
            const isDeal = item.category?.toLowerCase().includes('deal') || (item.name || '').toLowerCase().includes('deal')
            return (
              <tr key={idx} className="border-b-2 border-black last:border-b-0">
                <td className={`text-center py-1 px-1 ${!isKot ? 'border-r-2 border-black' : ''} uppercase ${isDeal ? 'font-black' : 'font-medium'}`}>
                  {item.name}
                  {itemVariantName(item) ? (
                    <div className="text-[10px] font-normal">({itemVariantName(item)})</div>
                  ) : null}
                  {item.selectedModifiers?.map((m: any) => (
                    <div key={m.name} className="text-[10px] font-normal">+ {m.name || m.modifier_name_snapshot}</div>
                  ))}
                  {(item as any).combo_components?.map((c: any, cidx: number) => (
                    <div key={cidx} className="text-[10px] font-normal">- {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.product_name} {c.variant_snapshot && `(${c.variant_snapshot})`}</div>
                  ))}
                  {item.notes && (
                    <div className="text-[10px] font-bold">Note: {item.notes}</div>
                  )}
                </td>
                <td className={`text-center py-1 px-1 ${!isKot ? 'border-r-2 border-black' : ''} font-medium text-xs align-middle`}>{item.quantity}</td>
                {!isKot && (
                  <td className="text-center py-1 px-1 font-medium whitespace-nowrap align-middle">
                    Rs {itemTotal.toFixed(2)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {notes && (
        <div className="mb-4 font-black border-t-2 border-dashed border-black pt-2 text-[11px]">NOTE: {notes}</div>
      )}

      {/* Totals */}
      {!isKot && (
        <div className="flex flex-col items-end text-[11px] space-y-0.5 mb-6 w-full pr-1">
          <div className="flex justify-end w-full">
            <span className="font-black mr-4">Subtotal:</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-end w-full">
              <span className="font-black mr-4">Discount:</span>
              <span>- Rs {discount.toFixed(2)}</span>
            </div>
          )}

          {orderType === 'Delivery' && deliveryCharge > 0 && (
            <div className="flex justify-end w-full">
              <span className="font-black mr-4">Delivery:</span>
              <span>Rs {deliveryCharge.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-end w-full font-black text-xs underline underline-offset-4 mt-1 pt-1">
            <span className="mr-4">Total Amount:</span>
            <span>Rs {total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-2 text-[11px] font-semibold flex flex-col items-center gap-1 mb-4">
        <p>{isKot ? <b className="text-sm">KITCHEN TICKET</b> : <>Thank you for your order!<br />Please visit again.</>}</p>
        {!isKot && (
          <>
            <img src="/receipt_qr.jpg" className="w-32 h-32 object-contain mt-4" onError={(e: any) => e.target.style.display = 'none'} />
            <div className="text-[11px] font-semibold mt-2">Powered by : corevex.tech (-_-)</div>
          </>
        )}
      </div>
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────────────
  if (onClose) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="relative w-full max-w-sm max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h3 className="font-bold text-foreground text-sm">Receipt — {orderNumber}</h3>
            <div className="flex items-center gap-2">
              <button onClick={doPrint} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-4">{receiptPreview}</div>
        </div>
      </div>
    )
  }

  // â”€â”€ Standalone page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipt Preview</h1>
          <p className="text-muted-foreground text-sm">Preview and print order receipt.</p>
        </div>
        <button onClick={doPrint} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20">
          <Printer className="w-4 h-4" /> Print Receipt
        </button>
      </div>
      <div className="flex justify-center">{receiptPreview}</div>
    </div>
  )
}


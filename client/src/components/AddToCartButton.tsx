'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Zap, MessageCircle, X, Minus, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'

interface Props {
  product: {
    id: number
    name: string
    price: number
    imageUrl: string | null
    stock: number
    unit: string
    farmerId: number
    farmerName: string
  }
}

type Mode = 'cart' | 'buy'

function stepFor(unit: string): number {
  return /kg|kilo|gram|\bg\b|lb|liter|litre|ml/.test(unit.toLowerCase()) ? 0.25 : 1
}

function fmtQty(n: number): string {
  return parseFloat(n.toFixed(2)).toString()
}

export default function AddToCartButton({ product }: Props) {
  const { isAuthenticated, user } = useAuth()
  const { addItem, items, clearCart } = useCart()
  const router = useRouter()

  const step = stepFor(product.unit)
  const [showModal, setShowModal] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const [quantity, setQuantity] = useState(step)
  const [pendingMode, setPendingMode] = useState<Mode>('cart')
  const [cartFlash, setCartFlash] = useState(false)

  const cartFarmerName = items.length > 0 ? items[0].farmerName : null
  const subtotal = product.price * quantity

  function openModal(mode: Mode) {
    if (!isAuthenticated) { router.push('/login'); return }
    setQuantity(step)
    setPendingMode(mode)
    setShowConflict(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setShowConflict(false)
  }

  function changeQty(delta: number) {
    setQuantity(q => {
      const next = parseFloat((q + delta).toFixed(2))
      return Math.min(Math.max(next, step), product.stock)
    })
  }

  function handleQtyInput(val: string) {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0) return
    setQuantity(Math.min(parseFloat(n.toFixed(2)), product.stock))
  }

  function doAdd(qty: number) {
    return addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      unit: product.unit,
      farmerId: product.farmerId,
      farmerName: product.farmerName,
    }, qty)
  }

  function handleConfirm(mode: Mode) {
    const result = doAdd(quantity)
    if (result === 'conflict') {
      setPendingMode(mode)
      setShowConflict(true)
      return
    }
    closeModal()
    if (mode === 'buy') {
      router.push('/cart')
    } else {
      setCartFlash(true)
      setTimeout(() => setCartFlash(false), 2000)
    }
  }

  function handleReplaceAndConfirm() {
    clearCart()
    doAdd(quantity)
    closeModal()
    if (pendingMode === 'buy') {
      router.push('/cart')
    } else {
      setCartFlash(true)
      setTimeout(() => setCartFlash(false), 2000)
    }
  }

  function handleMessageFarmer() {
    if (!isAuthenticated) { router.push('/login'); return }
    router.push(`/customer/messages/${product.farmerId}`)
  }

  // Buying and messaging farmers are for customers; guests are sent to log in.
  if (isAuthenticated && user?.role !== 'customer') return null

  if (product.stock === 0) {
    return (
      <div className="space-y-2">
        <button disabled className="btn w-full bg-gray-100 text-gray-500 cursor-not-allowed">
          Out of Stock
        </button>
        <button
          onClick={handleMessageFarmer}
          className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-paddy font-medium py-2 text-sm transition-colors"
        >
          <MessageCircle size={16} />
          Message Farmer
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => openModal('cart')}
            className={`btn flex-1 ${cartFlash ? 'bg-shoot text-paddy-deep' : 'btn-primary'}`}
          >
            <ShoppingCart size={16} />
            {cartFlash ? 'Added!' : 'Add to Cart'}
          </button>
          <button
            onClick={() => openModal('buy')}
            className="btn btn-outline flex-1"
          >
            <Zap size={16} />
            Buy Now
          </button>
        </div>

        <button
          onClick={handleMessageFarmer}
          className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-paddy font-medium py-2 text-sm transition-colors"
        >
          <MessageCircle size={16} />
          Message Farmer
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeModal} />

          <div role="dialog" aria-modal="true" aria-label={`Choose how much ${product.name}`} className="relative bg-white rounded-card shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-bold leading-tight">{product.name}</h3>
                <p className="text-sm text-gray-600 mt-0.5 tabular">₱{product.price.toFixed(2)} / {product.unit}</p>
              </div>
              <button onClick={closeModal} aria-label="Close" className="flex-shrink-0 text-gray-500 hover:text-soil transition-colors mt-0.5">
                <X size={20} />
              </button>
            </div>

            {showConflict ? (
              <div className="space-y-4">
                <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-1.5">
                  <p className="text-amber-800 font-medium text-sm">
                    Cart has items from <strong>{cartFarmerName}</strong>
                  </p>
                  <p className="text-amber-700 text-xs leading-relaxed">
                    Each order can only contain products from one farmer. Clear your cart to add this item instead?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleReplaceAndConfirm}
                    className="btn btn-primary flex-1"
                  >
                    Clear &amp; Continue
                  </button>
                  <button
                    onClick={closeModal}
                    className="btn flex-1 border-gray-300 text-gray-700 hover:border-gray-400"
                  >
                    Keep Cart
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Quantity selector */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => changeQty(-step)}
                      disabled={quantity <= step}
                      className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <div className="flex flex-col items-center gap-0.5">
                      <input
                        type="number"
                        min={step}
                        max={product.stock}
                        step={step}
                        value={fmtQty(quantity)}
                        onChange={e => handleQtyInput(e.target.value)}
                        className="w-20 text-center text-2xl font-bold text-gray-900 border-b-2 border-gray-200 focus:border-paddy focus:outline-none bg-transparent tabular-nums py-0.5"
                      />
                      <span className="text-xs text-gray-600">{product.unit}</span>
                    </div>
                    <button
                      onClick={() => changeQty(step)}
                      disabled={quantity >= product.stock}
                      className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 tabular">{fmtQty(product.stock)} {product.unit} available</p>
                </div>

                {/* Subtotal */}
                <div className="bg-field rounded-lg px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="font-display text-3xl font-bold tabular">₱{subtotal.toFixed(2)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm('cart')}
                    className="btn btn-primary flex-1"
                  >
                    <ShoppingCart size={15} />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => handleConfirm('buy')}
                    className="btn btn-outline flex-1"
                  >
                    <Zap size={15} />
                    Buy Now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

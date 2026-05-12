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
    farmerId: number
    farmerName: string
  }
}

type Mode = 'cart' | 'buy'

export default function AddToCartButton({ product }: Props) {
  const { isAuthenticated } = useAuth()
  const { addItem, items, clearCart } = useCart()
  const router = useRouter()

  const [showModal, setShowModal] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [pendingMode, setPendingMode] = useState<Mode>('cart')
  const [cartFlash, setCartFlash] = useState(false)

  const cartFarmerName = items.length > 0 ? items[0].farmerName : null
  const subtotal = product.price * quantity

  function openModal(mode: Mode) {
    if (!isAuthenticated) { router.push('/login'); return }
    setQuantity(1)
    setPendingMode(mode)
    setShowConflict(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setShowConflict(false)
  }

  function doAdd(qty: number) {
    return addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
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

  if (product.stock === 0) {
    return (
      <div className="space-y-2">
        <button disabled className="w-full bg-gray-200 text-gray-400 font-semibold py-3 rounded-xl cursor-not-allowed text-sm">
          Out of Stock
        </button>
        <button disabled className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-300 font-medium py-3 rounded-xl text-sm cursor-not-allowed">
          <MessageCircle size={16} />
          Message Farmer
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {/* Add to Cart + Buy Now */}
        <div className="flex gap-2">
          <button
            onClick={() => openModal('cart')}
            className={`flex-1 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
              cartFlash
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-green-700 hover:bg-green-800 text-white'
            }`}
          >
            <ShoppingCart size={16} />
            {cartFlash ? 'Added!' : 'Add to Cart'}
          </button>
          <button
            onClick={() => openModal('buy')}
            className="flex-1 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Zap size={16} />
            Buy Now
          </button>
        </div>

        {/* Message Farmer — UI only, not yet implemented */}
        <button
          disabled
          title="Messaging coming soon"
          className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-400 font-medium py-3 rounded-xl text-sm cursor-not-allowed select-none"
        >
          <MessageCircle size={16} />
          Message Farmer
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeModal} />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-base leading-snug">{product.name}</h3>
                <p className="text-sm text-gray-400 mt-0.5">₱{product.price.toFixed(2)} per unit</p>
              </div>
              <button onClick={closeModal} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                <X size={20} />
              </button>
            </div>

            {showConflict ? (
              /* Conflict resolution */
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
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Clear &amp; Continue
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 font-medium py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Keep Cart
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Quantity selector */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="text-3xl font-bold text-gray-900 w-12 text-center tabular-nums">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                      disabled={quantity >= product.stock}
                      className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">{product.stock} units available</p>
                </div>

                {/* Subtotal */}
                <div className="bg-gray-50 rounded-xl px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Subtotal</span>
                  <span className="text-xl font-bold text-green-700">₱{subtotal.toFixed(2)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm('cart')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                  >
                    <ShoppingCart size={15} />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => handleConfirm('buy')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
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

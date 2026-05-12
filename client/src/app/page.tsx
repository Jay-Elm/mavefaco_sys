import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import { ShoppingBag, Users, Leaf, ArrowRight } from "lucide-react";

async function getFeaturedProducts() {
  return prisma.product.findMany({
    take: 6,
    where: { approved: true },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      farmer: { select: { id: true, name: true, email: true } },
    },
  });
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-700 to-green-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Leaf size={48} className="text-green-300" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Fresh from the Farm,
            <br />
            Straight to You
          </h1>
          <p className="text-green-200 text-lg mb-8 max-w-xl mx-auto">
            CoopMarket connects local farmers with customers — buy fresh,
            support local, and grow together.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <ShoppingBag size={20} />
              Shop Now
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-lg transition-colors border border-white/30"
            >
              Join as a Farmer
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                icon: <Users size={32} className="text-green-600" />,
                title: "Farmers List Products",
                desc: "Registered farmers post their fresh harvest directly to the marketplace.",
              },
              {
                icon: <ShoppingBag size={32} className="text-green-600" />,
                title: "Customers Browse & Buy",
                desc: "Browse products by category and order directly from farmers near you.",
              },
              {
                icon: <Leaf size={32} className="text-green-600" />,
                title: "Fresh & Fair",
                desc: "Shorter supply chains mean fresher produce and better prices for everyone.",
              },
            ].map((step) => (
              <div key={step.title} className="text-center">
                <div className="flex justify-center mb-3">{step.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Latest Products
            </h2>
            <Link
              href="/products"
              className="text-green-700 hover:text-green-800 text-sm font-medium flex items-center gap-1"
            >
              View all <ArrowRight size={16} />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package48 />
              <p className="mt-4 text-lg">
                No products yet. Be the first to list!
              </p>
              <Link
                href="/register"
                className="mt-4 inline-block text-green-700 font-medium hover:underline"
              >
                Register as a farmer →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Package48() {
  return (
    <svg
      className="w-16 h-16 mx-auto text-gray-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
      />
    </svg>
  );
}

import Link from "next/link";

export default function StorefrontLanding() {
  return (
    <div className="space-y-10">
      <section className="bg-graphite text-white rounded-2xl px-8 py-12 text-center space-y-5">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Quality phones, laptops &amp; accessories
        </h1>
        <p className="text-white/65 max-w-xl mx-auto">
          Backed by a real warranty and a fair trade-up path when you&apos;re ready to upgrade.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/catalog" className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:opacity-90">
            Browse inventory
          </Link>
          <Link href="/trade-in" className="px-5 py-2.5 bg-transparent text-white border border-white/30 font-medium rounded-lg hover:bg-white/10">
            Get a trade-up quote
          </Link>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-lg font-bold mb-1">How trade-up works</h2>
        <p className="text-sm text-slate-500 mb-6">
          Bring your current phone and top up the difference for a better one, priced fairly by condition.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm">1. Pick the phone you want</h3>
              <p className="text-sm text-slate-500">Choose from our current inventory.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">2. Tell us about your current phone</h3>
              <p className="text-sm text-slate-500">Self-select a condition grade, and add photos if you&apos;d like our team to assess it remotely.</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm">3. Get an instant estimate</h3>
              <p className="text-sm text-slate-500">See your top-up amount right away, based on a fixed grading formula.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">4. We confirm in person</h3>
              <p className="text-sm text-slate-500">Our team confirms the final grade and value before anything is finalized.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center p-6">
      <div className="w-full max-w-4xl">
        <h1
          className="text-3xl md:text-5xl font-bold text-center mb-8"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
          }}
        >
          PRIVACY POLICY
        </h1>

        <div
          className="text-gray-300 font-mono space-y-6 leading-relaxed"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: "0.75rem",
          }}
        >
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              1. INFORMATION WE COLLECT
            </h2>
            <p>
              We collect information you provide directly to us, such as when
              you create an account, use our services, or contact us for
              support. This may include your email address, username, and
              Instagram verification details.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              2. HOW WE USE YOUR INFORMATION
            </h2>
            <p>
              We use the information we collect to provide, maintain, and
              improve our services, process transactions, send you technical
              notices and support messages, and respond to your comments and
              questions.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              3. INFORMATION SHARING
            </h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal
              information to third parties without your consent, except as
              described in this policy or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              4. DATA SECURITY
            </h2>
            <p>
              We implement appropriate security measures to protect your
              personal information against unauthorized access, alteration,
              disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              5. CONTACT US
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at codehamsters.ch@gmail.com.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-16 text-center"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          color: "#666666",
          fontSize: "0.6rem",
        }}
      >
        <p>THE CONTROL ROOM © 2025</p>
      </div>
    </div>
  );
}

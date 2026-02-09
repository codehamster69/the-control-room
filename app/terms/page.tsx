export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050905] flex flex-col items-center p-6">
      <div className="w-full max-w-4xl">
        <h1
          className="text-3xl md:text-5xl font-bold text-center mb-8"
          style={{
            fontFamily: "'Press Start 2P', cursive",
            color: "#ff00ff",
            textShadow: "0 0 5px #ff00ff, 0 0 8px #00ffff",
          }}
        >
          TERMS OF SERVICE
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
              1. ACCEPTANCE OF TERMS
            </h2>
            <p>
              By accessing and using The Control Room, you accept and agree to
              be bound by the terms and provisions of this agreement. If you do
              not agree to abide by these terms, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              2. USER ACCOUNTS
            </h2>
            <p>
              To access certain features of The Control Room, you must create an
              account. You are responsible for maintaining the confidentiality
              of your account credentials and for all activities that occur
              under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              3. INSTAGRAM VERIFICATION
            </h2>
            <p>
              Our service requires Instagram account verification. By verifying
              your Instagram account, you grant us permission to access your
              basic profile information for authentication purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              4. USER CONDUCT
            </h2>
            <p>
              You agree not to use The Control Room for any unlawful or
              prohibited purpose. You may not attempt to gain unauthorized
              access to any part of the service, or engage in any activity that
              interferes with or disrupts the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              5. INTELLECTUAL PROPERTY
            </h2>
            <p>
              The Control Room and its original content, features, and
              functionality are owned by The Control Room and are protected by
              international copyright, trademark, and other intellectual
              property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              6. DISCLAIMER
            </h2>
            <p>
              The Control Room is provided "as is" without any warranties,
              expressed or implied. We do not warrant that the service will be
              uninterrupted, timely, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              7. LIMITATION OF LIABILITY
            </h2>
            <p>
              In no event shall The Control Room be liable for any indirect,
              incidental, special, consequential, or punitive damages resulting
              from your use of or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              8. CHANGES TO TERMS
            </h2>
            <p>
              We reserve the right to modify or replace these Terms of Service
              at any time. Your continued use of the service after any changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-4" style={{ color: "#00ffff" }}>
              9. CONTACT US
            </h2>
            <p>
              If you have any questions about these Terms of Service, please
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

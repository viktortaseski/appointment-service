export default function StepsSection({ steps }) {
  return (
    <section className="section steps">
      <div className="section-header">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Three steps to a brighter smile.</h2>
        </div>
      </div>
      <div className="card-grid">
        {steps.map((step, index) => (
          <article
            className="card step"
            key={step.title}
            style={{ animationDelay: `${index * 140}ms` }}
          >
            <p className="step-index">0{index + 1}</p>
            <p className="step-title">{step.title}</p>
            <p className="step-detail">{step.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

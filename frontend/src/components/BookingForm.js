const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BookingForm({
  monthLabel,
  monthGrid,
  isPrevDisabled,
  onPrevMonth,
  onNextMonth,
  selectedDate,
  onSelectDate,
  formState,
  formErrors,
  onFieldChange,
  doctors,
  selectedDoctor,
  onSelectDoctor,
  timeSlots,
  selectedTime,
  onSelectTime,
  availability,
  onSubmit,
  isSubmitting,
  submitError,
}) {
  return (
    <form className="card form" id="book" onSubmit={onSubmit}>
      <div className="form-header">
        <h2>Reserve your visit</h2>
        <p>We will confirm by email within minutes.</p>
      </div>
      <div className="field">
        <label htmlFor="patientName">Full name</label>
        <input
          id="patientName"
          value={formState.patientName}
          onChange={(event) => onFieldChange('patientName', event.target.value)}
          placeholder="Jordan Smith"
          className={formErrors.patientName ? 'error' : ''}
        />
        {formErrors.patientName && (
          <span className="field-error">{formErrors.patientName}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="patientEmail">Email</label>
        <input
          id="patientEmail"
          type="email"
          value={formState.patientEmail}
          onChange={(event) => onFieldChange('patientEmail', event.target.value)}
          placeholder="you@email.com"
          className={formErrors.patientEmail ? 'error' : ''}
        />
        {formErrors.patientEmail && (
          <span className="field-error">{formErrors.patientEmail}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="patientPhone">Phone</label>
        <input
          id="patientPhone"
          type="tel"
          value={formState.patientPhone}
          onChange={(event) => onFieldChange('patientPhone', event.target.value)}
          placeholder="+1 (555) 000-0000"
          className={formErrors.patientPhone ? 'error' : ''}
        />
        {formErrors.patientPhone && (
          <span className="field-error">{formErrors.patientPhone}</span>
        )}
      </div>
      <div className="field">
        <div className="field-heading">
          <label>Choose a date</label>
          <span className="field-hint">Next available dates only</span>
        </div>
        <div className="calendar">
          <div className="calendar-header">
            <button
              type="button"
              className="icon-button"
              onClick={onPrevMonth}
              disabled={isPrevDisabled}
              aria-label="Previous month"
            >
              {'<'}
            </button>
            <span className="calendar-title">{monthLabel}</span>
            <button
              type="button"
              className="icon-button"
              onClick={onNextMonth}
              aria-label="Next month"
            >
              {'>'}
            </button>
          </div>
          <div className="calendar-grid calendar-weekdays">
            {DAY_LABELS.map((label) => (
              <span key={label} className="weekday">
                {label}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {monthGrid.map((slot, index) => {
              if (!slot) {
                return <div key={`blank-${index}`} className="calendar-blank" />;
              }

              return (
                <button
                  type="button"
                  key={slot.key}
                  className={`calendar-day${
                    selectedDate === slot.key ? ' selected' : ''
                  }`}
                  onClick={() => onSelectDate(slot.key)}
                  disabled={slot.isPast}
                >
                  {slot.day}
                </button>
              );
            })}
          </div>
        </div>
        {formErrors.date && <span className="field-error">{formErrors.date}</span>}
      </div>
      <div className="field">
        <label htmlFor="doctor">Doctor</label>
        <select
          id="doctor"
          value={selectedDoctor}
          onChange={(event) => onSelectDoctor(event.target.value)}
          className={formErrors.doctor ? 'error' : ''}
        >
          <option value="" disabled>
            Select a doctor
          </option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name} ({doctor.specialty})
            </option>
          ))}
        </select>
        {formErrors.doctor && (
          <span className="field-error">{formErrors.doctor}</span>
        )}
      </div>
      <div className="field">
        <div className="field-heading">
          <label>Choose a time</label>
          <span className="field-hint">9:00 AM - 4:00 PM, 30 min slots</span>
        </div>
        {!selectedDoctor && (
          <p className="inline-hint">Select a doctor to see availability.</p>
        )}
        {availability.error && (
          <p className="inline-hint error">{availability.error}</p>
        )}
        <div className="time-grid">
          {timeSlots.map((slot) => {
            const isTaken = availability.takenTimes.includes(slot.value);
            const isDisabled = !selectedDoctor || availability.loading || isTaken;

            return (
              <button
                type="button"
                key={slot.value}
                className={`slot-button time-slot${
                  selectedTime === slot.value ? ' selected' : ''
                }${isTaken ? ' taken' : ''}`}
                onClick={() => onSelectTime(slot.value)}
                disabled={isDisabled}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
        {formErrors.time && <span className="field-error">{formErrors.time}</span>}
      </div>
      {submitError && <p className="status error">{submitError}</p>}
      <button type="submit" className="cta full" disabled={isSubmitting}>
        {isSubmitting ? 'Confirming...' : 'Confirm appointment'}
      </button>
      <p className="form-footnote">
        Secure scheduling. No credit card required.
      </p>
    </form>
  );
}

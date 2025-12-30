const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getInitials(name) {
  if (!name) {
    return '';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

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
  doctorsStatus,
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
        <p>Healthy smiles start here. We will confirm by email within minutes.</p>
      </div>
      <div className="field">
        <div className="field-heading">
          <label>Choose your doctor</label>
        </div>
        {doctorsStatus?.loading && (
          <p className="inline-hint">Loading doctors...</p>
        )}
        {!doctorsStatus?.loading && doctors.length === 0 && (
          <p className="inline-hint">No doctors available for this clinic.</p>
        )}
        <div className="doctor-list">
          {doctors.map((doctor) => (
            <button
              type="button"
              key={doctor.id}
              className={`doctor-card${selectedDoctor === doctor.id ? ' selected' : ''}`}
              onClick={() => onSelectDoctor(doctor.id)}
            >
              <div className="doctor-avatar">
                {doctor.avatar ? (
                  <img src={doctor.avatar} alt={doctor.name} />
                ) : (
                  <span>{getInitials(doctor.name)}</span>
                )}
              </div>
              <p className="doctor-card-name">{doctor.name}</p>
              <p className="doctor-card-specialty">{doctor.specialty}</p>
            </button>
          ))}
        </div>
        {formErrors.doctor && (
          <span className="field-error">{formErrors.doctor}</span>
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
        <div className="field-heading">
          <label>Choose a time</label>
          <span className="field-hint">9:00 AM - 4:00 PM, 30 min slots</span>
        </div>
        {!selectedDoctor && (
          <p className="inline-hint">Select a doctor to see availability.</p>
        )}
        {availability.loading && selectedDoctor && (
          <p className="inline-hint">Loading available times...</p>
        )}
        {availability.error && (
          <p className="inline-hint error">{availability.error}</p>
        )}
        {!availability.loading && (
          <div className="time-grid">
            {timeSlots.map((slot) => {
              const isTaken = availability.takenTimes.includes(slot.value);
              const isDisabled = !selectedDoctor || isTaken;

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
        )}
        {formErrors.time && <span className="field-error">{formErrors.time}</span>}
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
        <label htmlFor="patientNotes">Notes</label>
        <textarea
          id="patientNotes"
          value={formState.patientNotes}
          onChange={(event) => onFieldChange('patientNotes', event.target.value)}
          placeholder="Anything we should know before your visit?"
          rows={3}
        />
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

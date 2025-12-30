const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BookingForm({
  monthLabel,
  monthGrid,
  isPrevDisabled,
  onPrevMonth,
  onNextMonth,
  selectedDate,
  onSelectDate,
  doctors,
  selectedDoctor,
  onSelectDoctor,
  timeSlots,
  selectedTime,
  onSelectTime,
  availability,
}) {
  return (
    <form className="card form" id="book">
      <div className="form-header">
        <h2>Reserve your visit</h2>
        <p>We will confirm by email within minutes.</p>
      </div>
      <div className="field">
        <label htmlFor="patientName">Full name</label>
        <input id="patientName" placeholder="Jordan Smith" />
      </div>
      <div className="field">
        <label htmlFor="patientEmail">Email</label>
        <input id="patientEmail" type="email" placeholder="you@email.com" />
      </div>
      <div className="field">
        <label htmlFor="patientPhone">Phone</label>
        <input id="patientPhone" type="tel" placeholder="+1 (555) 000-0000" />
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
      </div>
      <div className="field">
        <label htmlFor="doctor">Doctor</label>
        <select
          id="doctor"
          value={selectedDoctor}
          onChange={(event) => onSelectDoctor(event.target.value)}
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
      </div>
      <button type="button" className="cta full">Confirm appointment</button>
      <p className="form-footnote">
        Secure scheduling. No credit card required.
      </p>
    </form>
  );
}

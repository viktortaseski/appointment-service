'use client';

import { useI18n } from './I18nProvider';

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
  const { t } = useI18n();
  const dayLabels = [
    t('weekday_sun'),
    t('weekday_mon'),
    t('weekday_tue'),
    t('weekday_wed'),
    t('weekday_thu'),
    t('weekday_fri'),
    t('weekday_sat'),
  ];

  return (
    <form className="card form" id="book" onSubmit={onSubmit}>
      <div className="form-header">
        <h2>{t('reserve_title')}</h2>
        <p>{t('reserve_subtitle')}</p>
      </div>
      <div className="field" id="booking-date">
        <div className="field-heading">
          <label>{t('choose_doctor_label')}</label>
        </div>
        {doctorsStatus?.loading && (
          <p className="inline-hint">{t('loading_doctors')}</p>
        )}
        {!doctorsStatus?.loading && doctors.length === 0 && (
          <p className="inline-hint">{t('no_doctors')}</p>
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
          <label>{t('choose_date_label')}</label>
          <span className="field-hint">{t('date_hint')}</span>
        </div>
        <div className="calendar">
          <div className="calendar-header">
            <button
              type="button"
              className="icon-button"
              onClick={onPrevMonth}
              disabled={isPrevDisabled}
              aria-label={t('prev_month')}
            >
              {'<'}
            </button>
            <span className="calendar-title">{monthLabel}</span>
            <button
              type="button"
              className="icon-button"
              onClick={onNextMonth}
              aria-label={t('next_month')}
            >
              {'>'}
            </button>
          </div>
          <div className="calendar-grid calendar-weekdays">
            {dayLabels.map((label) => (
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
          <label>{t('choose_time_label')}</label>
          <span className="field-hint">{t('time_hint')}</span>
        </div>
        {!selectedDoctor && (
          <p className="inline-hint">{t('select_doctor_hint')}</p>
        )}
        {availability.loading && selectedDoctor && (
          <p className="inline-hint">{t('loading_times')}</p>
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
        <label htmlFor="patientName">{t('full_name_label')}</label>
        <input
          id="patientName"
          value={formState.patientName}
          onChange={(event) => onFieldChange('patientName', event.target.value)}
          placeholder={t('name_placeholder')}
          className={formErrors.patientName ? 'error' : ''}
        />
        {formErrors.patientName && (
          <span className="field-error">{formErrors.patientName}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="patientEmail">{t('email_label')}</label>
        <input
          id="patientEmail"
          type="email"
          value={formState.patientEmail}
          onChange={(event) => onFieldChange('patientEmail', event.target.value)}
          placeholder={t('email_placeholder')}
          className={formErrors.patientEmail ? 'error' : ''}
        />
        {formErrors.patientEmail && (
          <span className="field-error">{formErrors.patientEmail}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="patientPhone">{t('phone_label')}</label>
        <input
          id="patientPhone"
          type="tel"
          value={formState.patientPhone}
          onChange={(event) => onFieldChange('patientPhone', event.target.value)}
          placeholder={t('phone_placeholder')}
          className={formErrors.patientPhone ? 'error' : ''}
        />
        {formErrors.patientPhone && (
          <span className="field-error">{formErrors.patientPhone}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="patientNotes">{t('notes_label')}</label>
        <textarea
          id="patientNotes"
          value={formState.patientNotes}
          onChange={(event) => onFieldChange('patientNotes', event.target.value)}
          placeholder={t('notes_placeholder')}
          rows={3}
        />
      </div>
      {submitError && <p className="status error">{submitError}</p>}
      <button type="submit" className="cta full" disabled={isSubmitting}>
        {isSubmitting ? t('confirming') : t('confirm_appointment')}
      </button>
      <p className="form-footnote">
        {t('secure_scheduling')}
      </p>
    </form>
  );
}

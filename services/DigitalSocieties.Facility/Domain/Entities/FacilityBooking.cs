using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Facility.Domain.Events;

namespace DigitalSocieties.Facility.Domain.Entities;

/// <summary>
/// A single time-slot reservation of a Facility by a flat/resident.
/// </summary>
public sealed class FacilityBooking : AuditableEntity
{
    private FacilityBooking() { }

    private FacilityBooking(Guid id, Guid facilityId, Guid societyId,
        Guid flatId, Guid bookedBy, DateOnly bookingDate, TimeOnly startTime, TimeOnly endTime)
        : base(id)
    {
        FacilityId  = facilityId;
        SocietyId   = societyId;
        FlatId      = flatId;
        BookedBy    = bookedBy;
        BookingDate = bookingDate;
        StartTime   = startTime;
        EndTime     = endTime;
        Status      = BookingStatus.Confirmed;
    }

    public Guid          FacilityId  { get; private set; }
    public Guid          SocietyId   { get; private set; }
    public Guid          FlatId      { get; private set; }
    public Guid          BookedBy    { get; private set; }
    public DateOnly      BookingDate { get; private set; }
    public TimeOnly      StartTime   { get; private set; }
    public TimeOnly      EndTime     { get; private set; }
    public BookingStatus Status      { get; private set; }
    public string?       CancelReason { get; private set; }

    // Navigation (EF Core)
    public Facility? Facility { get; private set; }

    public static FacilityBooking Create(Guid facilityId, Guid societyId,
        Guid flatId, Guid bookedBy, DateOnly date, TimeOnly start, TimeOnly end)
    {
        var booking = new FacilityBooking(Guid.NewGuid(), facilityId, societyId,
                                          flatId, bookedBy, date, start, end);
        booking.Raise(new FacilityBookedEvent(booking.Id, facilityId, societyId, flatId, date));
        return booking;
    }

    public void Cancel(string reason)
    {
        if (Status == BookingStatus.Cancelled)
            throw new InvalidOperationException("Booking is already cancelled.");
        Status       = BookingStatus.Cancelled;
        CancelReason = reason;
        Raise(new FacilityBookingCancelledEvent(Id, FacilityId, SocietyId, FlatId));
    }
}

public enum BookingStatus { Confirmed, Cancelled, Completed }

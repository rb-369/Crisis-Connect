"""Demo dataset for the reseed button. Mumbai flavor, mirrors Dev A's
frontend design (same coordinates/copy) so the map and admin queue render a
consistent, checked-in demo scenario. Only used by /debug/reseed-demo.
"""
DEMO_HELPERS = [
    {
        "name": "Vikram Joshi",
        "phone": "+91 98201 44021",
        "email": "vikram.joshi@bloodheroes.org",
        "role": "volunteer",
        "org_name": "Mumbai Blood Heroes Network",
        "blood_type": "O-",
        "badge": "Universal Blood Donor (O-)",
        "lat": 19.0178,
        "lng": 72.8478,
    },
    {
        "name": "Dr. Rohit Deshmukh (Red Cross Mumbai)",
        "phone": "+91 98201 55019",
        "email": "rohit.deshmukh@redcrossmumbai.org",
        "role": "volunteer",
        "org_name": "Indian Red Cross Emergency Response Mumbai",
        "blood_type": "O+",
        "badge": "Red Cross Mumbai Paramedic (O+)",
        "lat": 19.0390,
        "lng": 72.8619,
    },
    {
        "name": "Pooja Mehta",
        "phone": "+91 98670 12890",
        "email": "pooja.mehta@kemdonors.in",
        "role": "volunteer",
        "org_name": "KEM Voluntary Donors League",
        "blood_type": "A+",
        "badge": "Registered Blood Donor (A+)",
        "lat": 19.0028,
        "lng": 72.8428,
    },
    {
        "name": "Rahul Sawant",
        "phone": "+91 98190 77654",
        "email": "rahul.sawant@mumbaicentral.org",
        "role": "volunteer",
        "org_name": "Mumbai Central Youth Donors",
        "blood_type": "B+",
        "badge": "Registered Blood Donor (B+)",
        "lat": 18.9712,
        "lng": 72.8197,
    },
    {
        "name": "Indian Red Cross Emergency Response Mumbai",
        "phone": "022-2410-7000",
        "email": "operations@redcrossmumbai.org",
        "role": "ngo_admin",
        "org_name": "Indian Red Cross Society",
        "darpan_id": "MH/2021/029104",
        "badge": "Darpan: MH/2021/029104",
        "lat": 18.9298,
        "lng": 72.8335,
    },
    {
        "name": "Dharavi Disaster Taskforce & Relief Fleet",
        "phone": "+91 98200 99881",
        "email": "relief@dharavitaskforce.org",
        "role": "ngo_admin",
        "org_name": "Dharavi Relief Initiative",
        "darpan_id": "MH/2020/018823",
        "badge": "Darpan: MH/2020/018823",
        "lat": 19.0434,
        "lng": 72.8567,
    },
    {
        "name": "Khalsa Aid Mumbai Crisis Wing",
        "phone": "+91 98210 33445",
        "email": "mumbai@khalsaaid.org",
        "role": "ngo_admin",
        "org_name": "Khalsa Aid International",
        "darpan_id": "MH/2019/044192",
        "badge": "Darpan: MH/2019/044192",
        "lat": 19.0760,
        "lng": 72.8777,
    },
]

DEMO_HELPER = DEMO_HELPERS[1]

DEMO_ZONE = {
    "category": "rescue",
    "center_lat": 19.0728,
    "center_lng": 72.8785,
    "ml_status": "confirmed_cluster_8_reports",
}

DEMO_REQUESTS = [
    dict(category="blood", urgency="high", lat=19.0178, lng=72.8478,
         requester_device_id="demo-device-mum-01",
         requester_name="KEM Hospital Blood Bank Liaison",
         requester_phone="022-2410-7000",
         details="CRITICAL: 4 units O-Negative plasma required for emergency "
                 "surgery patient, road flooded near Parel.",
         admin_status="approved", zone_confirmed=True),
    dict(category="oxygen", urgency="high", lat=19.0390, lng=72.8619,
         requester_device_id="demo-device-mum-02",
         requester_name="Ramesh Kulkarni", requester_phone="9820511043",
         details="Sion West: Elderly patient on continuous oxygen, power "
                 "transformer submerged. Need backup D-type cylinder.",
         admin_status="pending", zone_confirmed=True),
    dict(category="rescue", urgency="high", lat=19.0688, lng=72.8785,
         requester_device_id="demo-device-mum-03",
         requester_name="Sunita Patil", requester_phone="9867044188",
         details="Kurla West, Bail Bazar: Ground floor tenement submerged up "
                 "to chest level. 5 family members trapped on loft.",
         admin_status="approved", zone_confirmed=True),
    dict(category="food", urgency="normal", lat=19.0434, lng=72.8567,
         requester_device_id="demo-device-mum-04",
         requester_name="Dharavi Relief Center Unit 5", requester_phone="9819022112",
         details="Safe drinking water cans and dry biscuits packets needed "
                 "for 40 displaced residents sheltering at municipal school.",
         admin_status="approved", zone_confirmed=False),
    dict(category="medicine", urgency="normal", lat=19.0596, lng=72.8295,
         requester_device_id="demo-device-mum-05",
         requester_name="Anil Fernandes", requester_phone="9821077165",
         details="Bandra West, Hill Road: Type 1 insulin pens and sterile "
                 "saline kit needed for elderly resident.",
         admin_status="pending", zone_confirmed=False),
]

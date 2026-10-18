# Tamil Nadu postal directory

`tamil-nadu-postcodes.json` is a property-validation snapshot derived from the Department of Posts All India PIN Code Directory CSV:

https://www.data.gov.in/sites/default/files/all_india_pin_code.csv

Downloaded 17 October 2026. Catalog: https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month

Publisher: Department of Posts, Government of India. Catalog license: Government Open Data License – India. The catalog does not establish the publication date of this legacy CSV, so this is not represented as a current, live address-verification service.

The snapshot retains only rows whose `statename` is `TAMIL NADU`, grouped by PIN, with unique post office, taluk and district names. Office suffixes B.O/S.O/H.O are removed. It contains 2,029 PIN codes. No customer information is included. Refresh the source snapshot when postal areas change. Validation requires exactly six digits starting with 6 and a PIN present in this Tamil Nadu snapshot. City and address text are not cross-checked with the stored postal names. This does not validate a street address or ownership.

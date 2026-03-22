;; title: satspay-registry
;; summary: Maps hashed phone numbers to Stacks wallet addresses.
;; description: Enables sending directly to a recipient's wallet based on their phone number after initial claim.

;; constants
(define-constant err-already-registered (err u100))
(define-constant err-address-has-phone (err u101))
(define-constant err-not-registered (err u200))
(define-constant err-update-not-registered (err u300))
(define-constant err-not-owner (err u301))

;; data maps
(define-map phone-registry
  { phone-hash: (buff 32) }
  {
    owner: principal,
    registered-at: uint,
    active: bool
  }
)

(define-map address-to-phone
  { owner: principal }
  { phone-hash: (buff 32) }
)

;; public functions
(define-public (register (phone-hash (buff 32)))
  (begin
    ;; 1. Verify phone-hash is not already registered
    (asserts! (is-none (map-get? phone-registry { phone-hash: phone-hash })) err-already-registered)
    
    ;; 2. Check the caller (tx-sender) doesn't already have a registered phone
    (asserts! (is-none (map-get? address-to-phone { owner: tx-sender })) err-address-has-phone)
    
    ;; 3. Write to phone-registry
    (map-set phone-registry 
      { phone-hash: phone-hash } 
      { owner: tx-sender, registered-at: block-height, active: true }
    )
    
    ;; 4. Write to address-to-phone for reverse lookup
    (map-set address-to-phone 
      { owner: tx-sender } 
      { phone-hash: phone-hash }
    )
    
    ;; 5. Emit event
    (print { event: "phone-registered", phone-hash: phone-hash, owner: tx-sender, registered-at: block-height })
    
    (ok true)
  )
)

(define-public (deregister)
  (let (
      (phone-record (unwrap! (map-get? address-to-phone { owner: tx-sender }) err-not-registered))
      (phone-hash (get phone-hash phone-record))
    )
    ;; Delete from both mappings
    (map-delete phone-registry { phone-hash: phone-hash })
    (map-delete address-to-phone { owner: tx-sender })
    
    ;; Emit event
    (print { event: "phone-deregistered", phone-hash: phone-hash, owner: tx-sender })
    
    (ok true)
  )
)

(define-public (update-address (phone-hash (buff 32)) (new-address principal))
  (let (
      (reg-record (unwrap! (map-get? phone-registry { phone-hash: phone-hash }) err-update-not-registered))
      (current-owner (get owner reg-record))
    )
    ;; 1. Verify the caller is the current owner
    (asserts! (is-eq current-owner tx-sender) err-not-owner)
    
    ;; Note: We leave address uniqueness implicitly handled (another address can't register the same phone, but here an owner updates their own address)
    
    ;; 2. Update mapping in phone-registry
    (map-set phone-registry 
      { phone-hash: phone-hash } 
      (merge reg-record { owner: new-address })
    )
    
    ;; 3. Update address-to-phone reverse lookup
    (map-delete address-to-phone { owner: tx-sender })
    (map-set address-to-phone 
      { owner: new-address } 
      { phone-hash: phone-hash }
    )
    
    ;; 4. Emit event
    (print { event: "address-updated", phone-hash: phone-hash, old-address: tx-sender, new-address: new-address })
    
    (ok true)
  )
)

;; read only functions
(define-read-only (get-address-for-phone (phone-hash (buff 32)))
  (map-get? phone-registry { phone-hash: phone-hash })
)

(define-read-only (is-registered (phone-hash (buff 32)))
  (is-some (map-get? phone-registry { phone-hash: phone-hash }))
)

(define-read-only (get-phone-for-address (address principal))
  (map-get? address-to-phone { owner: address })
)

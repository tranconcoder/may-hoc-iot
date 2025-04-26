document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const searchForm = document.getElementById("searchForm");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const resultsSection = document.getElementById("resultsSection");
  const noResultsMessage = document.getElementById("noResultsMessage");
  const resultsTable = document.getElementById("resultsTable");
  const resultCount = document.getElementById("resultCount");
  const pagination = document.getElementById("pagination");
  const searchInput = document.getElementById("licensePlate");
  const searchButton = document.getElementById("searchButton");

  // Explicitly prevent default form submission and use AJAX instead
  function performSearch(e) {
    // Always prevent the default form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const formData = new FormData(searchForm);
    const searchParams = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (value) searchParams.append(key, value);
    }

    // Add page parameter (start at page 1)
    searchParams.append("page", "1");

    // Show loading indicator with animation
    loadingIndicator.classList.remove("d-none");
    loadingIndicator.classList.add("fade-in");
    resultsSection.classList.add("d-none");
    noResultsMessage.classList.add("d-none");

    // Perform search
    searchLicensePlates(searchParams);

    // Return false to ensure no form submission happens
    return false;
  }

  // Handle form submission - multiple ways to ensure it doesn't reload
  searchForm.onsubmit = performSearch;
  searchForm.addEventListener("submit", performSearch);

  // Also handle click on search button directly
  searchButton.addEventListener("click", function (e) {
    e.preventDefault();
    performSearch();
  });

  // Auto-focus search input on page load
  searchInput.focus();

  // Function to search license plates
  function searchLicensePlates(searchParams) {
    fetch("/api/license-plates/search?" + searchParams.toString())
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Hide loading indicator
        loadingIndicator.classList.add("d-none");

        if (!data.metadata.results || data.metadata.results.length === 0) {
          // No results
          noResultsMessage.classList.remove("d-none");
          noResultsMessage.classList.add("bounce-in");
        } else {
          // Show results
          resultsSection.classList.remove("d-none");
          resultsSection.classList.add("fade-in");

          // Update result count
          resultCount.textContent = `${data.metadata.pagination.total} kết quả`;

          // Render results
          renderResults(data.metadata.results, data.metadata.pagination);
        }
      })
      .catch((error) => {
        console.error("Error searching license plates:", error);
        loadingIndicator.classList.add("d-none");

        // Show error message
        noResultsMessage.classList.remove("d-none");
        noResultsMessage.classList.add("bounce-in");
        noResultsMessage.querySelector("h4").textContent = "Đã xảy ra lỗi";
        noResultsMessage.querySelector("p.mb-1").textContent =
          "Không thể tìm kiếm biển số xe. Vui lòng thử lại sau.";
        noResultsMessage.querySelector("p.mb-0").textContent = error.message;
      });
  }

  // Function to render search results
  function renderResults(results, pagination) {
    // Clear previous results
    resultsTable.innerHTML = "";

    // Calculate start index for row numbering
    const startIndex = (pagination.page - 1) * pagination.limit;

    // Render rows
    results.forEach((result, index) => {
      const row = document.createElement("tr");

      const detectedDate = new Date(result.detected_at);
      const formattedDate = detectedDate.toLocaleDateString("vi-VN");
      const formattedTime = detectedDate.toLocaleTimeString("vi-VN");

      row.innerHTML = `
        <td class="text-center">${startIndex + index + 1}</td>
        <td><span class="badge bg-dark license-plate-badge">${
          result.license_plate
        }</span></td>
        <td>
          <div class="d-flex align-items-center">
            <i class="far fa-calendar-alt text-primary me-2"></i>
            <div>
              <div>${formattedDate}</div>
              <div class="small text-muted">${formattedTime}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-video text-primary me-2"></i>
            <span>${result.camera_id?.camera_name || "N/A"}</span>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-map-marker-alt text-primary me-2"></i>
            <span>${result.camera_id?.camera_location || "N/A"}</span>
          </div>
        </td>
        <td class="text-center">
          <div class="position-relative" style="width: 100px; height: 75px; margin: 0 auto;">
            <div class="image-thumbnail-loading" id="loading-${result._id}">
              <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Đang tải...</span>
              </div>
            </div>
            <img src="/api/license-plates/image/${
              result._id
            }" class="img-thumbnail w-100 h-100 result-image" 
              style="object-fit: cover;" alt="${result.license_plate}" 
              onload="document.getElementById('loading-${
                result._id
              }').style.display='none'"
              onerror="this.onerror=null; document.getElementById('loading-${
                result._id
              }').style.display='none'; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%2275%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2075%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18d20eabc32%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18d20eabc32%22%3E%3Crect%20width%3D%22100%22%20height%3D%2275%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2219%22%20y%3D%2244%22%3ENo Image%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';">
          </div>
        </td>
        <td class="text-center">
          <button class="btn btn-outline-primary btn-sm view-details" data-id="${
            result._id
          }">
            <i class="fas fa-eye me-1"></i> Chi tiết
          </button>
        </td>
      `;

      resultsTable.appendChild(row);
    });

    // Add event listeners to view detail buttons
    document.querySelectorAll(".view-details").forEach((button) => {
      button.addEventListener("click", function () {
        const id = this.getAttribute("data-id");
        showLicensePlateDetails(id);
      });
    });

    // Render pagination
    renderPagination(pagination);
  }

  // Function to render pagination
  function renderPagination(paginationData) {
    // Clear previous pagination
    pagination.innerHTML = "";

    const { page, totalPages } = paginationData;

    if (totalPages <= 1) return;

    // Previous button
    const prevLi = document.createElement("li");
    prevLi.className = `page-item ${page === 1 ? "disabled" : ""}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${
      page - 1
    }" aria-label="Previous">
                          <span aria-hidden="true">&laquo;</span>
                        </a>`;
    pagination.appendChild(prevLi);

    // Page numbers
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, page + 2);

    // Ensure we always show 5 pages if possible
    if (endPage - startPage < 4) {
      if (startPage === 1) {
        endPage = Math.min(5, totalPages);
      } else {
        startPage = Math.max(1, endPage - 4);
      }
    }

    // First page
    if (startPage > 1) {
      const firstLi = document.createElement("li");
      firstLi.className = "page-item";
      firstLi.innerHTML = `<a class="page-link" href="#" data-page="1">1</a>`;
      pagination.appendChild(firstLi);

      if (startPage > 2) {
        const ellipsisLi = document.createElement("li");
        ellipsisLi.className = "page-item disabled";
        ellipsisLi.innerHTML = `<a class="page-link" href="#">...</a>`;
        pagination.appendChild(ellipsisLi);
      }
    }

    // Middle pages
    for (let i = startPage; i <= endPage; i++) {
      const pageLi = document.createElement("li");
      pageLi.className = `page-item ${i === page ? "active" : ""}`;
      pageLi.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
      pagination.appendChild(pageLi);
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsisLi = document.createElement("li");
        ellipsisLi.className = "page-item disabled";
        ellipsisLi.innerHTML = `<a class="page-link" href="#">...</a>`;
        pagination.appendChild(ellipsisLi);
      }

      const lastLi = document.createElement("li");
      lastLi.className = "page-item";
      lastLi.innerHTML = `<a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>`;
      pagination.appendChild(lastLi);
    }

    // Next button
    const nextLi = document.createElement("li");
    nextLi.className = `page-item ${page === totalPages ? "disabled" : ""}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${
      page + 1
    }" aria-label="Next">
                          <span aria-hidden="true">&raquo;</span>
                        </a>`;
    pagination.appendChild(nextLi);

    // Add event listeners to page links
    document.querySelectorAll(".page-link").forEach((link) => {
      link.addEventListener("click", function (e) {
        // Ensure the default link behavior is prevented
        e.preventDefault();
        e.stopPropagation();

        const newPage = parseInt(this.getAttribute("data-page"));
        if (
          isNaN(newPage) ||
          newPage < 1 ||
          newPage > totalPages ||
          newPage === page
        )
          return false;

        const formData = new FormData(searchForm);
        const searchParams = new URLSearchParams();

        for (const [key, value] of formData.entries()) {
          if (value) searchParams.append(key, value);
        }

        searchParams.append("page", newPage.toString());

        // Show loading indicator
        loadingIndicator.classList.remove("d-none");
        loadingIndicator.classList.add("fade-in");
        resultsSection.classList.add("d-none");

        // Perform search with new page
        searchLicensePlates(searchParams);

        // Scroll to top of results
        window.scrollTo({
          top: document.getElementById("searchForm").offsetTop - 20,
          behavior: "smooth",
        });

        return false;
      });
    });
  }

  // Function to show license plate details
  function showLicensePlateDetails(id) {
    // Show loading in modal
    const modal = new bootstrap.Modal(
      document.getElementById("licensePlateModal")
    );
    document.getElementById("modalPlateNumber").textContent = "Đang tải...";
    document.getElementById("modalDateTime").textContent = "Đang tải...";
    document.getElementById("modalCamera").textContent = "Đang tải...";
    document.getElementById("modalLocation").textContent = "Đang tải...";

    // Show image loading indicator
    const imageLoading = document.querySelector(".image-loading");
    imageLoading.style.display = "flex";

    // Set placeholder image
    document.getElementById("modalImage").src =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%2275%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2075%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18d20eabc32%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18d20eabc32%22%3E%3Crect%20width%3D%22100%22%20height%3D%2275%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2219%22%20y%3D%2244%22%3ELoading...%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

    // Show modal
    modal.show();

    fetch(`/api/license-plates/details/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const result = data.metadata;

        // Populate modal with animation
        const plateNumber = document.getElementById("modalPlateNumber");
        plateNumber.textContent = result.license_plate;
        plateNumber.classList.add("bounce-in");

        // Set image source with error handling
        const modalImage = document.getElementById("modalImage");
        modalImage.onerror = function () {
          this.onerror = null;
          this.src =
            "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%2275%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2075%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18d20eabc32%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18d20eabc32%22%3E%3Crect%20width%3D%22100%22%20height%3D%2275%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2219%22%20y%3D%2244%22%3ENo Image%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
          imageLoading.style.display = "none";
        };
        modalImage.onload = function () {
          imageLoading.style.display = "none";
          this.classList.add("fade-in");
        };
        modalImage.src = `/api/license-plates/image/${result._id}`;

        const detectedDate = new Date(result.detected_at);
        document.getElementById(
          "modalDateTime"
        ).textContent = `${detectedDate.toLocaleDateString(
          "vi-VN"
        )} ${detectedDate.toLocaleTimeString("vi-VN")}`;

        document.getElementById("modalCamera").textContent =
          result.camera_id?.camera_name || "N/A";
        document.getElementById("modalLocation").textContent =
          result.camera_id?.camera_location || "N/A";
      })
      .catch((error) => {
        console.error("Error fetching license plate details:", error);
        document.getElementById("modalPlateNumber").textContent = "Lỗi";
        document.getElementById("modalDateTime").textContent =
          "Không thể tải thông tin";
        document.getElementById("modalCamera").textContent =
          "Không thể tải thông tin";
        document.getElementById("modalLocation").textContent =
          "Không thể tải thông tin";
        document.getElementById("modalImage").src =
          "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%2275%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2075%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18d20eabc32%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18d20eabc32%22%3E%3Crect%20width%3D%22100%22%20height%3D%2275%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2219%22%20y%3D%2244%22%3EError%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
        imageLoading.style.display = "none";
      });
  }

  // Add hover effect to search button
  searchButton.classList.add("search-button");

  // Add animation on page load
  const heroSection = document.querySelector(".hero-section");
  const searchCard = document.querySelector(".search-card");

  if (heroSection) heroSection.classList.add("fade-in");
  if (searchCard) searchCard.classList.add("bounce-in");
});

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Page-number pagination mirroring the frontend ``ListParams`` contract.

    Query params: ``?page=&page_size=&search=`` (search handled by DRF filter).
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200
